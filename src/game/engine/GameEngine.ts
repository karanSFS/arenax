// ═══════════════════════════════════════════
// GAME ENGINE
// Main orchestrator: game loop, systems, rendering
// ═══════════════════════════════════════════

import { Player, ProjectileData } from "@/game/entities/Player";
import { Bot, BotDifficulty } from "@/game/ai/BotAI";
import { ParticleSystem } from "@/game/particles/ParticleSystem";
import { KeyboardController, TouchController, InputState } from "@/game/input/InputController";
import { ARENAS, ArenaConfig } from "@/game/maps/Arena";

export type GamePhase = "countdown" | "playing" | "finished";

export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  color: string;
  life: number;
}

export interface KillFeed {
  killer: string;
  victim: string;
  timestamp: number;
}

export interface GameEngineCallbacks {
  onKill?: (killer: Player, victim: Player) => void;
  onDeath?: (player: Player) => void;
  onMatchEnd?: (winner: Player, stats: MatchStats) => void;
  onHUDUpdate?: (hud: HUDData) => void;
}

export interface MatchStats {
  winnerId: string;
  winnerUsername: string;
  players: Array<{
    userId: string;
    username: string;
    characterId: string;
    kills: number;
    deaths: number;
    damage: number;
    score: number;
  }>;
  duration: number;
}

export interface HUDData {
  localPlayer: {
    health: number;
    maxHealth: number;
    kills: number;
    deaths: number;
    score: number;
    abilities: {
      primary: { cooldown: number; max: number };
      secondary: { cooldown: number; max: number };
      ultimate: { cooldown: number; max: number };
    };
  };
  timeRemaining: number;
  phase: GamePhase;
  killFeed: KillFeed[];
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private arena: ArenaConfig;
  private localPlayer!: Player;
  private remotePlayers: Map<string, Player> = new Map();
  private bots: Bot[] = [];
  private projectiles: Map<string, ProjectileData> = new Map();
  private particles: ParticleSystem;
  private keyboard!: KeyboardController;
  private touchController: TouchController = new TouchController();
  private callbacks: GameEngineCallbacks;

  // Game state
  private phase: GamePhase = "countdown";
  private countdownTimer = 3;
  private matchTimer = 180; // 3 minutes
  private startTime = 0;
  private projectileIdCounter = 0;

  // Camera
  private cameraX = 0;
  private cameraY = 0;
  private targetCameraX = 0;
  private targetCameraY = 0;
  private screenShake = 0;

  // HUD state
  private damageNumbers: DamageNumber[] = [];
  private killFeed: KillFeed[] = [];

  // RAF handle
  private rafHandle = 0;
  private lastTime = 0;
  private isDestroyed = false;

  // Screen size
  private viewW: number;
  private viewH: number;

  constructor(
    canvas: HTMLCanvasElement,
    arenaId: string,
    callbacks: GameEngineCallbacks = {}
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.arena = ARENAS[arenaId] || ARENAS.cyber_grid;
    this.particles = new ParticleSystem(600);
    this.callbacks = callbacks;
    this.viewW = canvas.width;
    this.viewH = canvas.height;
    this.keyboard = new KeyboardController(canvas);

    // Mouse click attack
    canvas.addEventListener("mousedown", () => this.keyboard.setMouseClick(true));
    canvas.addEventListener("mouseup", () => this.keyboard.setMouseClick(false));

    // Prevent context menu
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // ─── Setup ─────────────────────────────────────────────────────────────────

  setupLocalPlayer(userId: string, username: string, characterSlug: string) {
    const spawn = this.arena.spawnPoints[0];
    this.localPlayer = new Player(
      { id: "local", userId, username, characterSlug, isLocal: true },
      spawn.x,
      spawn.y
    );
    this.updateCamera(true);
  }

  addBot(characterSlug: string, difficulty: BotDifficulty = "normal") {
    const spawnIdx = this.bots.length + 1;
    const spawn = this.arena.spawnPoints[spawnIdx % this.arena.spawnPoints.length];
    const bot = new Bot(
      { id: `bot-${this.bots.length}`, userId: `bot-${this.bots.length}`, username: `BOT_${["NOVA", "APEX", "ZETA", "KIRA"][this.bots.length % 4]}`, characterSlug, isLocal: false },
      spawn.x,
      spawn.y,
      difficulty
    );
    this.bots.push(bot);
  }

  setTouchController(tc: TouchController) {
    this.touchController = tc;
  }

  addRemotePlayer(id: string, userId: string, username: string, characterSlug: string, x?: number, y?: number) {
    if (this.remotePlayers.has(id) || (this.localPlayer && this.localPlayer.id === id)) return;
    const spawnIdx = (this.remotePlayers.size + 1) % this.arena.spawnPoints.length;
    const spawn = this.arena.spawnPoints[spawnIdx];
    const player = new Player(
      { id, userId, username, characterSlug, isLocal: false },
      x !== undefined ? x : spawn.x,
      y !== undefined ? y : spawn.y
    );
    this.remotePlayers.set(id, player);
  }

  updateRemotePlayer(id: string, data: any) {
    const player = this.remotePlayers.get(id);
    if (!player) {
      if (data.userId && data.username && data.characterSlug) {
        this.addRemotePlayer(id, data.userId, data.username, data.characterSlug, data.x, data.y);
      }
      return;
    }
    player.setRemoteState(data);
  }

  removeRemotePlayer(id: string) {
    this.remotePlayers.delete(id);
  }

  triggerRemoteAction(id: string, action: { type: string; data?: any }) {
    const player = this.remotePlayers.get(id);
    if (!player) return;

    if (action.type === "primary") {
      const res = player.activatePrimary();
      if (res?.projectile) this.spawnProjectile(res.projectile);
    } else if (action.type === "secondary") {
      const res = player.activateSecondary();
      if (res?.projectile) this.spawnProjectile(res.projectile);
    } else if (action.type === "ultimate") {
      const res = player.activateUltimate();
      if (res?.projectile) this.spawnProjectile(res.projectile);
      if (res?.aoe) this.processAOE(player, res.aoe.x, res.aoe.y, res.aoe.radius, res.aoe.damage);
    }
  }

  getLocalPlayerState() {
    if (!this.localPlayer) return null;
    return {
      userId: this.localPlayer.userId,
      username: this.localPlayer.username,
      characterSlug: this.localPlayer.characterSlug,
      x: Math.round(this.localPlayer.x),
      y: Math.round(this.localPlayer.y),
      vx: Math.round(this.localPlayer.vx),
      vy: Math.round(this.localPlayer.vy),
      facing: parseFloat(this.localPlayer.facing.toFixed(3)),
      health: Math.round(this.localPlayer.health),
      maxHealth: this.localPlayer.maxHealth,
      score: this.localPlayer.score,
      kills: this.localPlayer.kills,
      deaths: this.localPlayer.deaths,
      isAlive: this.localPlayer.isAlive,
    };
  }

  // ─── Game Loop ─────────────────────────────────────────────────────────────

  start() {
    this.lastTime = performance.now();
    this.startTime = Date.now();
    this.loop();
  }

  private loop() {
    if (this.isDestroyed) return;
    this.rafHandle = requestAnimationFrame((time) => {
      const dt = Math.min((time - this.lastTime) / 1000, 0.05); // cap delta
      this.lastTime = time;

      this.update(dt);
      this.render();

      this.loop();
    });
  }

  private update(dt: number) {
    // ── Countdown ────────────────────────────────────────────
    if (this.phase === "countdown") {
      this.countdownTimer -= dt;
      if (this.countdownTimer <= 0) {
        this.phase = "playing";
        this.matchTimer = 180;
      }
      return; // Don't update gameplay during countdown
    }

    if (this.phase === "finished") return;

    // ── Match timer ──────────────────────────────────────────
    this.matchTimer -= dt;
    if (this.matchTimer <= 0) {
      this.endMatch();
      return;
    }

    // ── Input ────────────────────────────────────────────────
    const kb = this.keyboard.getState();
    const touch = this.touchController.getState();
    const input: InputState = {
      up: kb.up || touch.up,
      down: kb.down || touch.down,
      left: kb.left || touch.left,
      right: kb.right || touch.right,
      attack: kb.attack || touch.attack,
      ability1: kb.ability1 || touch.ability1,
      ability2: kb.ability2 || touch.ability2,
      ultimate: kb.ultimate || touch.ultimate,
      aimX: (touch.aimX !== 0 || touch.aimY !== 0) ? touch.aimX : kb.aimX,
      aimY: (touch.aimX !== 0 || touch.aimY !== 0) ? touch.aimY : kb.aimY,
      sequence: kb.sequence + touch.sequence,
    };

    // ── Local player ─────────────────────────────────────────
    if (this.localPlayer) {
      if (this.localPlayer.isAlive) {
        this.localPlayer.applyInput(input, this.cameraX, this.cameraY);
        this.handleAttackInput(input);
      } else if (this.localPlayer.respawnTimer <= 0) {
        const spawn = this.arena.spawnPoints[0];
        this.localPlayer.respawn(spawn.x + (Math.random() - 0.5) * 80, spawn.y + (Math.random() - 0.5) * 80);
        this.particles.healEffect(this.localPlayer.x, this.localPlayer.y);
      }
      this.localPlayer.update(dt, this.arena.walls, this.arena.width, this.arena.height);
    }

    // ── Bots ─────────────────────────────────────────────────
    const allPlayers = this.localPlayer ? [this.localPlayer, ...this.bots, ...Array.from(this.remotePlayers.values())] : [...this.bots];
    for (const bot of this.bots) {
      if (!bot.isAlive && bot.respawnTimer <= 0) {
        const spawnIdx = Math.floor(Math.random() * this.arena.spawnPoints.length);
        const spawn = this.arena.spawnPoints[spawnIdx];
        bot.respawn(spawn.x + (Math.random() - 0.5) * 60, spawn.y + (Math.random() - 0.5) * 60);
        this.particles.healEffect(bot.x, bot.y);
      }

      const result = bot.updateAI(dt, allPlayers, this.arena.width, this.arena.height);
      bot.update(dt, this.arena.walls, this.arena.width, this.arena.height);

      if (result && "projectile" in result && result.projectile) {
        this.spawnProjectile(result.projectile);
      }
      if (result && "aoe" in result && result.aoe) {
        this.processAOE(bot, result.aoe.x, result.aoe.y, result.aoe.radius, result.aoe.damage);
      }
    }

    // ── Remote players ────────────────────────────────────────
    for (const rp of this.remotePlayers.values()) {
      rp.updateRemote(dt);
    }

    // ── Projectiles ───────────────────────────────────────────
    for (const [pid, proj] of this.projectiles) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;
      this.particles.projectileTrail(proj.x, proj.y, proj.color);

      if (proj.life <= 0) {
        this.projectiles.delete(pid);
        continue;
      }

      // Wall collision
      let wallHit = false;
      for (const wall of this.arena.walls) {
        if (
          proj.x + proj.radius > wall.x &&
          proj.x - proj.radius < wall.x + wall.width &&
          proj.y + proj.radius > wall.y &&
          proj.y - proj.radius < wall.y + wall.height
        ) {
          wallHit = true;
          break;
        }
      }
      if (wallHit) {
        this.particles.sparks(proj.x, proj.y, proj.color, 5);
        this.projectiles.delete(pid);
        continue;
      }

      // Player collision
      const targets = this.localPlayer ? [this.localPlayer, ...this.bots] : [...this.bots];
      for (const target of targets) {
        if (target.id === proj.ownerId || !target.isAlive) continue;
        const dist = Math.hypot(target.x - proj.x, target.y - proj.y);
        if (dist < target.radius + proj.radius) {
          const owner = this.getPlayerById(proj.ownerId);
          if (owner) {
            const dmg = target.takeDamage(proj.damage);
            owner.damageDealt += dmg;
            this.addDamageNumber(proj.x, proj.y, dmg, proj.color);
            this.particles.hit(proj.x, proj.y, proj.color, 10);
            this.screenShake = 0.3;

            if (!target.isAlive) {
              this.handleKill(owner, target);
            }
          }
          this.projectiles.delete(pid);
          break;
        }
      }
    }

    // ── Melee collision check ─────────────────────────────────
    // (handled in handleAttackInput)

    // ── Particles ─────────────────────────────────────────────
    this.particles.update(dt);

    // Ambient particles
    if (this.localPlayer) {
      this.particles.ambient(this.localPlayer.x, this.localPlayer.y, this.arena.ambientParticleColor);
    }

    // ── Camera ────────────────────────────────────────────────
    this.updateCamera(false);

    // ── Screen shake ──────────────────────────────────────────
    this.screenShake = Math.max(0, this.screenShake - dt * 4);

    // ── Damage numbers ────────────────────────────────────────
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dn = this.damageNumbers[i];
      dn.y -= 30 * dt;
      dn.life -= dt;
      if (dn.life <= 0) this.damageNumbers.splice(i, 1);
    }

    // ── Kill feed cleanup ─────────────────────────────────────
    const now = Date.now();
    this.killFeed = this.killFeed.filter((k) => now - k.timestamp < 4000);

    // ── HUD update ────────────────────────────────────────────
    if (this.localPlayer) {
      const cds = this.localPlayer.getAbilityCooldowns();
      this.callbacks.onHUDUpdate?.({
        localPlayer: {
          health: this.localPlayer.health,
          maxHealth: this.localPlayer.maxHealth,
          kills: this.localPlayer.kills,
          deaths: this.localPlayer.deaths,
          score: this.localPlayer.score,
          abilities: {
            primary: { cooldown: cds.primary.current, max: cds.primary.max },
            secondary: { cooldown: cds.secondary.current, max: cds.secondary.max },
            ultimate: { cooldown: cds.ultimate.current, max: cds.ultimate.max },
          },
        },
        timeRemaining: Math.max(0, this.matchTimer),
        phase: this.phase,
        killFeed: this.killFeed,
      });
    }
  }

  private handleAttackInput(input: InputState) {
    if (!this.localPlayer || !this.localPlayer.isAlive) return;

    // Primary attack
    if (input.attack) {
      const result = this.localPlayer.activatePrimary();
      if (result?.projectile) {
        this.spawnProjectile(result.projectile);
      } else if (result?.damage) {
        this.processMelee(this.localPlayer, result.damage);
      }
    }

    // Ability Q
    if (input.ability1) {
      const result = this.localPlayer.activateSecondary();
      if (result?.projectile) this.spawnProjectile(result.projectile);
      if (result?.dash) {
        this.localPlayer.vx += result.dash.dx;
        this.localPlayer.vy += result.dash.dy;
        this.particles.explosion(this.localPlayer.x, this.localPlayer.y, this.localPlayer.accentColor, 12);
      }
    }

    // Ability E
    if (input.ability2) {
      const result = this.localPlayer.activateUltimate();
      if (result?.projectile) {
        this.spawnProjectile(result.projectile);
        this.screenShake = 0.5;
        this.particles.explosion(this.localPlayer.x, this.localPlayer.y, this.localPlayer.accentColor, 20);
      }
      if (result?.aoe) {
        this.processAOE(this.localPlayer, result.aoe.x, result.aoe.y, result.aoe.radius, result.aoe.damage);
        this.screenShake = 0.8;
        this.particles.explosion(result.aoe.x, result.aoe.y, this.localPlayer.accentColor, 30);
      }
    }
  }

  private processMelee(attacker: Player, damage: number) {
    const targets = [...this.bots, ...Array.from(this.remotePlayers.values())];
    for (const target of targets) {
      if (!target.isAlive) continue;
      const dist = Math.hypot(target.x - attacker.x, target.y - attacker.y);
      const range = attacker.radius + target.radius + 30;
      if (dist < range) {
        const dmg = target.takeDamage(damage);
        attacker.damageDealt += dmg;
        this.addDamageNumber(target.x, target.y - 20, dmg, attacker.color);
        this.particles.hit(target.x, target.y, attacker.color, 8);
        this.screenShake = 0.25;

        if (!target.isAlive) {
          this.handleKill(attacker, target);
        }
        break; // Melee hits one target
      }
    }
  }

  private processAOE(attacker: Player, x: number, y: number, radius: number, damage: number) {
    const targets = attacker.isLocal
      ? [...this.bots, ...Array.from(this.remotePlayers.values())]
      : [this.localPlayer, ...this.bots.filter((b) => b !== attacker)];

    for (const target of targets) {
      if (!target || !target.isAlive) continue;
      const dist = Math.hypot(target.x - x, target.y - y);
      if (dist < radius + target.radius) {
        const falloff = 1 - dist / (radius + target.radius);
        const dmg = target.takeDamage(damage * falloff);
        attacker.damageDealt += dmg;
        this.addDamageNumber(target.x, target.y - 30, dmg, attacker.color);

        if (!target.isAlive) {
          this.handleKill(attacker, target);
        }
      }
    }
  }

  private spawnProjectile(proj: Omit<ProjectileData, "id">) {
    const id = `proj-${++this.projectileIdCounter}`;
    this.projectiles.set(id, { ...proj, id });
  }

  private handleKill(killer: Player, victim: Player) {
    killer.kills++;
    killer.score += 100;
    this.particles.death(victim.x, victim.y, victim.color);
    this.screenShake = 0.6;

    this.killFeed.unshift({
      killer: killer.username,
      victim: victim.username,
      timestamp: Date.now(),
    });
    if (this.killFeed.length > 5) this.killFeed.pop();

    this.callbacks.onKill?.(killer, victim);
    this.callbacks.onDeath?.(victim);

    // Check if match should end (first to 10 kills in non-timed mode, or based on config)
    const allPlayers = this.localPlayer ? [this.localPlayer, ...this.bots] : [...this.bots];
    const maxKills = allPlayers.reduce((m, p) => Math.max(m, p.kills), 0);
    if (maxKills >= 5) {
      // 5 kills wins for practice
      const winner = allPlayers.find((p) => p.kills >= 5);
      if (winner) setTimeout(() => this.endMatch(winner), 1000);
    }
  }

  private endMatch(winner?: Player) {
    if (this.phase === "finished") return;
    this.phase = "finished";

    const allPlayers = this.localPlayer ? [this.localPlayer, ...this.bots] : [...this.bots];
    let w = winner;
    if (!w) {
      // Most kills wins
      w = allPlayers.reduce((best, p) => (p.kills > best.kills ? p : best), allPlayers[0]);
    }

    const duration = Math.round((Date.now() - this.startTime) / 1000);

    const stats: MatchStats = {
      winnerId: w.userId,
      winnerUsername: w.username,
      players: allPlayers.map((p) => ({
        userId: p.userId,
        username: p.username,
        characterId: p.characterSlug,
        kills: p.kills,
        deaths: p.deaths,
        damage: p.damageDealt,
        score: p.score,
      })),
      duration,
    };

    this.callbacks.onMatchEnd?.(w, stats);
  }

  private getPlayerById(id: string): Player | undefined {
    if (this.localPlayer?.id === id) return this.localPlayer;
    const remote = this.remotePlayers.get(id);
    if (remote) return remote;
    return this.bots.find((b) => b.id === id);
  }

  private updateCamera(instant: boolean) {
    if (!this.localPlayer) return;
    this.targetCameraX = this.localPlayer.x - this.viewW / 2;
    this.targetCameraY = this.localPlayer.y - this.viewH / 2;

    // Clamp to arena
    this.targetCameraX = Math.max(0, Math.min(this.arena.width - this.viewW, this.targetCameraX));
    this.targetCameraY = Math.max(0, Math.min(this.arena.height - this.viewH, this.targetCameraY));

    if (instant) {
      this.cameraX = this.targetCameraX;
      this.cameraY = this.targetCameraY;
    } else {
      this.cameraX += (this.targetCameraX - this.cameraX) * 0.08;
      this.cameraY += (this.targetCameraY - this.cameraY) * 0.08;
    }
  }

  private addDamageNumber(x: number, y: number, value: number, color: string) {
    this.damageNumbers.push({ x, y, value: Math.round(value), color, life: 0.8 });
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  private render() {
    const { ctx, canvas } = this;

    // Screen shake offset
    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 12 : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake * 12 : 0;

    const camX = this.cameraX + shakeX;
    const camY = this.cameraY + shakeY;

    // Clear
    ctx.fillStyle = this.arena.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camX, -camY);

    // Grid
    this.renderGrid(ctx);

    // Walls
    this.renderWalls(ctx);

    // Bots
    for (const bot of this.bots) {
      this.renderPlayer(ctx, bot);
    }

    // Remote players
    for (const rp of this.remotePlayers.values()) {
      this.renderPlayer(ctx, rp);
    }

    // Local player
    if (this.localPlayer) {
      this.renderPlayer(ctx, this.localPlayer);
    }

    // Projectiles with high-energy glowing streak tails
    for (const proj of this.projectiles.values()) {
      ctx.save();
      const speed = Math.hypot(proj.vx, proj.vy);
      if (speed > 1) {
        const nx = proj.vx / speed;
        const ny = proj.vy / speed;
        const tailLength = Math.min(26, proj.radius * 3.5);
        const grad = ctx.createLinearGradient(proj.x, proj.y, proj.x - nx * tailLength, proj.y - ny * tailLength);
        grad.addColorStop(0, proj.color);
        grad.addColorStop(1, "transparent");
        ctx.strokeStyle = grad;
        ctx.lineWidth = proj.radius * 1.8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(proj.x, proj.y);
        ctx.lineTo(proj.x - nx * tailLength, proj.y - ny * tailLength);
        ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = proj.radius * 3;
      ctx.shadowColor = proj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Particles
    this.particles.render(ctx, 0, 0); // already translated

    // Damage numbers
    for (const dn of this.damageNumbers) {
      const alpha = dn.life / 0.8;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = dn.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = dn.color;
      ctx.font = `bold ${20 + (1 - alpha) * 8}px 'Orbitron', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`-${dn.value}`, dn.x, dn.y);
      ctx.restore();
    }

    ctx.restore();

    // Countdown overlay
    if (this.phase === "countdown") {
      this.renderCountdown(ctx);
    }
  }

  private renderGrid(ctx: CanvasRenderingContext2D) {
    const gridSize = 40;
    ctx.save();
    ctx.strokeStyle = this.arena.gridColor;
    ctx.lineWidth = 1;

    for (let x = 0; x < this.arena.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.arena.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.arena.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.arena.width, y);
      ctx.stroke();
    }

    // Border glow
    ctx.strokeStyle = this.arena.accentColor;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.arena.accentColor;
    ctx.strokeRect(2, 2, this.arena.width - 4, this.arena.height - 4);
    ctx.restore();
  }

  private renderWalls(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const wall of this.arena.walls) {
      // Fill
      ctx.fillStyle = "rgba(10, 10, 30, 0.95)";
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

      // Border
      ctx.strokeStyle = this.arena.accentColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.arena.accentColor;
      ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);

      // Inner highlight
      ctx.strokeStyle = `${this.arena.accentColor}33`;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.strokeRect(wall.x + 3, wall.y + 3, wall.width - 6, wall.height - 6);
    }
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, player: Player) {
    if (!player.isAlive) return;

    const { x, y, radius, color, accentColor, facing, hitFlash, isInvisible, characterSlug } = player;

    if (isInvisible && !player.isLocal) return;

    const isMoving = Math.hypot(player.vx, player.vy) > 10;
    const now = Date.now();

    // 1. Ground Shadow
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.beginPath();
    ctx.ellipse(x, y + 5, radius * 0.9, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Tactical Player Indicator (Local Player Highlight)
    if (player.isLocal) {
      const rot = now * 0.0025;
      ctx.save();
      ctx.strokeStyle = "rgba(0, 245, 255, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#00f5ff";
      ctx.beginPath();
      ctx.arc(x, y, radius + 8, rot, rot + Math.PI * 1.4);
      ctx.stroke();

      // Front directional indicator pip
      const tipDist = radius + 12;
      ctx.fillStyle = "#00f5ff";
      ctx.beginPath();
      ctx.arc(x + Math.cos(facing) * tipDist, y + Math.sin(facing) * tipDist, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Rotated Fighter Rendering (+X is Forward / Facing)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);

    if (isInvisible) {
      ctx.globalAlpha = 0.35;
    }
    if (hitFlash > 0) {
      ctx.globalAlpha = Math.min(1, 0.6 + hitFlash * 0.4);
    }

    // A. Mini-Militia Jetpack Thruster Flames (Shooting backwards, -X direction)
    const flameBaseX = -radius + 4;
    const thrusterY1 = -9;
    const thrusterY2 = 9;

    // Thruster Mounts
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.fillRect(flameBaseX - 3, thrusterY1 - 3, 6, 6);
    ctx.strokeRect(flameBaseX - 3, thrusterY1 - 3, 6, 6);
    ctx.fillRect(flameBaseX - 3, thrusterY2 - 3, 6, 6);
    ctx.strokeRect(flameBaseX - 3, thrusterY2 - 3, 6, 6);

    if (isMoving) {
      const flameLen = 14 + Math.sin(now * 0.035) * 6;
      for (const ty of [thrusterY1, thrusterY2]) {
        ctx.save();
        const flameGrad = ctx.createLinearGradient(flameBaseX, ty, flameBaseX - flameLen, ty);
        flameGrad.addColorStop(0, "#ffffff");
        flameGrad.addColorStop(0.3, accentColor || "#00f5ff");
        flameGrad.addColorStop(0.7, color || "#ff6b00");
        flameGrad.addColorStop(1, "transparent");

        ctx.fillStyle = flameGrad;
        ctx.shadowBlur = 12;
        ctx.shadowColor = accentColor || "#00f5ff";
        ctx.beginPath();
        ctx.moveTo(flameBaseX - 2, ty - 3.5);
        ctx.lineTo(flameBaseX - flameLen, ty + (Math.random() - 0.5) * 3);
        ctx.lineTo(flameBaseX - 2, ty + 3.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // B. Shoulder Pauldrons (Left & Right armored shoulder plates)
    const pauldronW = characterSlug === "titan" ? 14 : 11;
    const pauldronH = characterSlug === "titan" ? 10 : 8;
    const pauldronSpread = characterSlug === "titan" ? 18 : 15;

    for (const side of [-1, 1]) {
      const py = side * pauldronSpread;
      ctx.save();
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = color;

      ctx.beginPath();
      ctx.roundRect(-5, py - pauldronH / 2, pauldronW, pauldronH, 4);
      ctx.fill();
      ctx.stroke();

      // Pauldron crest stripe
      ctx.fillStyle = accentColor;
      ctx.fillRect(-2, py - 2, 5, 4);
      ctx.restore();
    }

    // C. Armored Torso / Exosuit Chassis
    ctx.save();
    ctx.fillStyle = hitFlash > 0 ? "#ffffff" : "#111827";
    ctx.strokeStyle = hitFlash > 0 ? "#ffffff" : color;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = hitFlash > 0 ? 15 : 8;
    ctx.shadowColor = hitFlash > 0 ? "#ffffff" : color;

    // Tactical vest silhouette
    ctx.beginPath();
    ctx.moveTo(radius * 0.45, -radius * 0.5);
    ctx.lineTo(radius * 0.45, radius * 0.5);
    ctx.lineTo(-radius * 0.4, radius * 0.55);
    ctx.lineTo(-radius * 0.55, 0);
    ctx.lineTo(-radius * 0.4, -radius * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Central Core / Emblem
    ctx.fillStyle = accentColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = accentColor;
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // D. Tactical Weapons & Arms (Facing Forward +X)
    ctx.save();
    // Arm gauntlets gripping firearm
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;

    // Right arm extending to weapon
    ctx.beginPath();
    ctx.roundRect(4, 5, 10, 6, 2);
    ctx.fill();
    ctx.stroke();

    // Left arm stabilizing weapon or secondary
    ctx.beginPath();
    ctx.roundRect(2, -10, 8, 5, 2);
    ctx.fill();
    ctx.stroke();

    // Weapon Type Rendering
    if (characterSlug === "volt") {
      // Long Cyber Railgun with Energy Capacitors
      ctx.fillStyle = "#090d16";
      ctx.strokeStyle = "#00f5ff";
      ctx.lineWidth = 1.5;
      ctx.fillRect(8, 5, 26, 4);
      ctx.strokeRect(8, 5, 26, 4);

      // Energy capacitor rings
      ctx.fillStyle = "#00f5ff";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#00f5ff";
      ctx.fillRect(16, 4, 3, 6);
      ctx.fillRect(24, 4, 3, 6);

      // Local Aim Laser Line
      if (player.isLocal) {
        ctx.strokeStyle = "rgba(0, 245, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(34, 7);
        ctx.lineTo(160, 7);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (characterSlug === "titan") {
      // Juggernaut Autocannon + Left Riot Shield
      ctx.fillStyle = "#052e16";
      ctx.strokeStyle = "#39ff14";
      ctx.lineWidth = 2;
      ctx.fillRect(10, -14, 5, 14);
      ctx.strokeRect(10, -14, 5, 14);

      // Twin-barrel heavy cannon on right
      ctx.fillStyle = "#1f2937";
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.fillRect(8, 4, 18, 4);
      ctx.fillRect(8, 9, 18, 4);
      ctx.strokeRect(8, 4, 18, 9);
    } else if (characterSlug === "phantom") {
      // Dual Stealth Plasma Blades / Silenced Needler
      ctx.fillStyle = "#9333ea";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#bf5fff";
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.lineTo(24, -12);
      ctx.lineTo(12, -5);
      ctx.closePath();
      ctx.fill();

      // Right silenced firearm
      ctx.fillStyle = "#18181b";
      ctx.strokeStyle = "#bf5fff";
      ctx.lineWidth = 1.2;
      ctx.fillRect(8, 5, 16, 3.5);
      ctx.strokeRect(8, 5, 16, 3.5);
    } else {
      // Blaze / Default: Heavy Thermal Carbine
      ctx.fillStyle = "#1c1917";
      ctx.strokeStyle = "#ff6b00";
      ctx.lineWidth = 1.5;
      ctx.fillRect(8, 5, 18, 5.5);
      ctx.strokeRect(8, 5, 18, 5.5);

      // Heat vent glowing orange
      ctx.fillStyle = "#ff2d00";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#ff2d00";
      ctx.fillRect(14, 6.5, 7, 2.5);

      if (player.isLocal) {
        ctx.strokeStyle = "rgba(255, 107, 0, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(26, 7.5);
        ctx.lineTo(140, 7.5);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Muzzle Flash Effect (if recently attacked)
    if (player.primaryCooldown > 0.25 || player.animState === "attack") {
      ctx.save();
      const muzzleX = characterSlug === "volt" ? 34 : 26;
      const muzzleY = 7;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 16;
      ctx.shadowColor = accentColor || "#ffffff";
      ctx.beginPath();
      ctx.arc(muzzleX, muzzleY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Starburst rays
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(muzzleX - 4, muzzleY);
      ctx.lineTo(muzzleX + 8, muzzleY);
      ctx.moveTo(muzzleX + 2, muzzleY - 6);
      ctx.lineTo(muzzleX + 2, muzzleY + 6);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // E. Combat Helmet & High-Tech Visor
    ctx.save();
    // Helmet base
    ctx.fillStyle = hitFlash > 0 ? "#ffffff" : "#0f172a";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#000000";
    ctx.beginPath();
    ctx.arc(-1, 0, radius * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Curved Glowing Visor Glass (Front-facing +X)
    const visorGrad = ctx.createLinearGradient(2, -7, 9, 7);
    visorGrad.addColorStop(0, "#ffffff");
    visorGrad.addColorStop(0.35, accentColor || "#00f5ff");
    visorGrad.addColorStop(1, color || "#0080ff");

    ctx.fillStyle = visorGrad;
    ctx.shadowBlur = 12;
    ctx.shadowColor = accentColor || "#00f5ff";
    ctx.beginPath();
    ctx.arc(1, 0, radius * 0.42, -Math.PI * 0.38, Math.PI * 0.38);
    ctx.lineTo(4, 0);
    ctx.closePath();
    ctx.fill();

    // Visor specular glass shine highlight
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(1, 0, radius * 0.4, -Math.PI * 0.28, -Math.PI * 0.05);
    ctx.stroke();
    ctx.restore();

    // F. Hexagonal Shield Bubble (Titan buff / Forcefield)
    if (characterSlug === "titan" && player.secondaryCooldown > 0) {
      ctx.save();
      ctx.strokeStyle = "#39ff14";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#39ff14";
      ctx.fillStyle = "rgba(57, 255, 20, 0.12)";
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const ang = (a * Math.PI) / 3;
        const hx = Math.cos(ang) * (radius + 6);
        const hy = Math.sin(ang) * (radius + 6);
        if (a === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // Exit translated/rotated coordinate space

    // 4. Tactical Health Bar & Player Name Tag
    const barW = 54;
    const barH = 5;
    const barX = x - barW / 2;
    const barY = y - radius - 16;

    // Health bar backdrop
    ctx.fillStyle = "rgba(10, 15, 28, 0.85)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Health bar fill
    const hpColor = player.healthPercent > 0.5 ? "#39ff14" : player.healthPercent > 0.25 ? "#ffd700" : "#ff2d78";
    ctx.fillStyle = hpColor;
    ctx.shadowBlur = 4;
    ctx.shadowColor = hpColor;
    ctx.fillRect(barX, barY, Math.max(0, barW * player.healthPercent), barH);
    ctx.shadowBlur = 0;

    // Player Name & Role Badge
    ctx.save();
    ctx.font = "bold 10px 'Orbitron', monospace";
    ctx.textAlign = "center";

    if (player.isLocal) {
      ctx.fillStyle = "#00f5ff";
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#00f5ff";
      ctx.fillText(`[YOU] ${player.username}`, x, barY - 5);
    } else {
      ctx.fillStyle = "#e2e8f0";
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#000000";
      const roleTag = characterSlug ? `[${characterSlug.toUpperCase()}] ` : "";
      ctx.fillText(`${roleTag}${player.username}`, x, barY - 5);
    }
    ctx.restore();
  }

  private renderCountdown(ctx: CanvasRenderingContext2D) {
    const { canvas } = this;
    const countdown = Math.ceil(this.countdownTimer);
    const progress = 1 - (this.countdownTimer % 1);

    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.6 - progress * 0.3})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (countdown > 0) {
      const scale = 1 + progress * 0.5;
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(scale, scale);

      ctx.fillStyle = "#00f5ff";
      ctx.shadowBlur = 60;
      ctx.shadowColor = "#00f5ff";
      ctx.font = `bold ${150}px 'Orbitron', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 1 - progress * 0.8;
      ctx.fillText(countdown.toString(), 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = "#ff2d78";
      ctx.shadowBlur = 40;
      ctx.shadowColor = "#ff2d78";
      ctx.font = `bold 100px 'Orbitron', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FIGHT!", canvas.width / 2, canvas.height / 2);
    }
    ctx.restore();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.rafHandle);
    this.keyboard.destroy();
    this.particles.clear();
  }

  getLocalPlayer() {
    return this.localPlayer;
  }

  getTouchController(): TouchController {
    return this.touchController;
  }

  getPhase() {
    return this.phase;
  }

  resize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.viewW = w;
    this.viewH = h;
  }
}
