// ═══════════════════════════════════════════
// BOT AI
// State machine AI for Practice mode
// ═══════════════════════════════════════════

import { Player } from "@/game/entities/Player";

export type BotDifficulty = "easy" | "normal" | "hard";

type BotState = "patrol" | "chase" | "attack" | "dodge" | "retreat";

export class Bot extends Player {
  private state: BotState = "patrol";
  private target: Player | null = null;
  private difficulty: BotDifficulty;
  private stateTimer = 0;
  private patrolTarget = { x: 0, y: 0 };
  private reactionTime: number;
  private attackRange: number;
  private dodgeTimer = 0;

  // Difficulty-based parameters
  private readonly params = {
    easy: { reactionTime: 1.5, attackRange: 120, aimAccuracy: 0.4, dodgeChance: 0.1 },
    normal: { reactionTime: 0.8, attackRange: 160, aimAccuracy: 0.7, dodgeChance: 0.3 },
    hard: { reactionTime: 0.3, attackRange: 200, aimAccuracy: 0.9, dodgeChance: 0.6 },
  };

  constructor(data: ConstructorParameters<typeof Player>[0], spawnX: number, spawnY: number, difficulty: BotDifficulty = "normal") {
    super(data, spawnX, spawnY);
    this.difficulty = difficulty;
    const p = this.params[difficulty];
    this.reactionTime = p.reactionTime;
    this.attackRange = p.attackRange;
    this.patrolTarget = { x: spawnX, y: spawnY };
  }

  updateAI(dt: number, players: Player[], arenaW: number, arenaH: number) {
    if (!this.isAlive) return null;

    this.stateTimer -= dt;
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);

    // Find nearest alive player target
    this.target = null;
    let minDist = Infinity;
    for (const p of players) {
      if (p === this) continue;
      if (!p.isAlive) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < minDist) {
        minDist = d;
        this.target = p;
      }
    }

    // State machine
    const action = this.runStateMachine(dt, minDist, arenaW, arenaH);
    return action;
  }

  private runStateMachine(dt: number, distToTarget: number, arenaW: number, arenaH: number) {
    let actionResult = null;

    switch (this.state) {
      case "patrol":
        this.doPatrol(arenaW, arenaH);
        if (this.target && distToTarget < 500) {
          this.setState("chase");
        }
        break;

      case "chase":
        if (!this.target || !this.target.isAlive) {
          this.setState("patrol");
          break;
        }
        this.moveToward(this.target.x, this.target.y);
        this.facing = Math.atan2(this.target.y - this.y, this.target.x - this.x);

        if (distToTarget < this.attackRange) {
          this.setState("attack");
        } else if (distToTarget > 700) {
          this.setState("patrol");
        }
        break;

      case "attack":
        if (!this.target || !this.target.isAlive) {
          this.setState("patrol");
          break;
        }

        // Aim with some inaccuracy
        const accuracy = this.params[this.difficulty].aimAccuracy;
        const jitter = (1 - accuracy) * 60;
        const aimX = this.target.x + (Math.random() - 0.5) * jitter;
        const aimY = this.target.y + (Math.random() - 0.5) * jitter;
        this.facing = Math.atan2(aimY - this.y, aimX - this.x);

        // Strafe while attacking
        const strafeAngle = this.facing + Math.PI / 2;
        this.vx += Math.cos(strafeAngle) * this.speed * 0.05 * (Math.sin(Date.now() / 500) > 0 ? 1 : -1);
        this.vy += Math.sin(strafeAngle) * this.speed * 0.05 * (Math.sin(Date.now() / 500) > 0 ? 1 : -1);

        // Attack decision
        if (this.stateTimer <= 0) {
          actionResult = this.decideAttack();
          this.stateTimer = this.reactionTime * (0.5 + Math.random());
        }

        if (distToTarget > this.attackRange * 1.5) {
          this.setState("chase");
        }

        // Dodge incoming
        if (Math.random() < this.params[this.difficulty].dodgeChance * dt && this.dodgeTimer <= 0) {
          this.setState("dodge");
          this.dodgeTimer = 0.8;
        }
        break;

      case "dodge":
        // Move perpendicular to threat
        if (this.target) {
          const perp = Math.atan2(this.target.y - this.y, this.target.x - this.x) + Math.PI / 2;
          this.vx += Math.cos(perp) * this.speed * 0.12;
          this.vy += Math.sin(perp) * this.speed * 0.12;
        }
        if (this.stateTimer <= 0) {
          this.setState("chase");
        }
        break;

      case "retreat":
        if (this.target) {
          const awayAngle = Math.atan2(this.y - this.target.y, this.x - this.target.x);
          this.vx += Math.cos(awayAngle) * this.speed * 0.1;
          this.vy += Math.sin(awayAngle) * this.speed * 0.1;
        }
        if (this.stateTimer <= 0 || this.health > this.maxHealth * 0.5) {
          this.setState("chase");
        }
        break;
    }

    // Retreat when low health
    if (this.health < this.maxHealth * 0.25 && this.state !== "retreat") {
      this.setState("retreat");
    }

    return actionResult;
  }

  private decideAttack() {
    // Try abilities with some randomness
    const r = Math.random();
    if (r < 0.6) {
      return this.activatePrimary();
    } else if (r < 0.8) {
      return this.activateSecondary();
    } else if (r < 0.95 && this.ultimateCooldown <= 0) {
      return this.activateUltimate();
    }
    return null;
  }

  private setState(state: BotState) {
    this.state = state;
    this.stateTimer = {
      patrol: 2 + Math.random() * 2,
      chase: 3,
      attack: this.reactionTime,
      dodge: 0.8,
      retreat: 1 + Math.random(),
    }[state];
  }

  private moveToward(tx: number, ty: number) {
    const angle = Math.atan2(ty - this.y, tx - this.x);
    this.vx += Math.cos(angle) * this.speed * 0.12;
    this.vy += Math.sin(angle) * this.speed * 0.12;
  }

  private doPatrol(arenaW: number, arenaH: number) {
    const dist = Math.hypot(this.patrolTarget.x - this.x, this.patrolTarget.y - this.y);
    if (dist < 30) {
      this.patrolTarget = {
        x: 100 + Math.random() * (arenaW - 200),
        y: 100 + Math.random() * (arenaH - 200),
      };
    }
    this.moveToward(this.patrolTarget.x, this.patrolTarget.y);
  }
}
