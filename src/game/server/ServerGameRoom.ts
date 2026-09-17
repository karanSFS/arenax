/**
 * ServerGameRoom.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 * Authoritative Server Game Simulation for ArenaX Multiplayer
 *
 * Core Principles:
 * 1. SERVER-AUTHORITATIVE: Server controls positions, collisions, HP, kills, projectiles.
 * 2. FIXED TICK SIMULATION: Fixed dt = 0.05s (20 Hz), deterministic and frame-independent.
 * 3. CONTINUOUS SWEPT-COLLISION: Swept-circle vs walls & players. First-collision-wins.
 * 4. STABLE IDS: Uses userId as stable playerId; deterministic projectile IDs.
 * 5. WORLD COORDINATES: All simulation strictly in world coordinates.
 * 6. SNAPSHOTS & HISTORY: Emits sequenced snapshots with serverTick for reconciliation & interpolation.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { ARENAS, ArenaConfig, ArenaWall } from "../maps/Arena";
import { CHARACTER_DATA, CharacterDef } from "../characters/CharacterConfig";
import {
  sweepSegmentVsAABB,
  sweepSegmentVsCircle,
  clampToBounds,
} from "../physics/sweptCollision";

export const SERVER_TICK_RATE = 20; // 20 ticks per second
export const SERVER_TICK_DT = 1 / SERVER_TICK_RATE; // 0.05 seconds per tick
const PLAYER_TIMEOUT_MS = 15_000; // 15s inactivity timeout

export interface ClientInputPacket {
  seq: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  worldAimX: number;
  worldAimY: number;
  facing: number;
  isMouseAiming?: boolean;
  action?: {
    type: "primary" | "secondary" | "tactical" | "ultimate";
    timestamp: number;
    actionId?: string;
  };
  dt?: number;
}

export interface ServerPlayer {
  id: string; // stable playerId (userId)
  userId: string;
  username: string;
  characterSlug: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  radius: number;
  health: number;
  maxHealth: number;
  speed: number;
  attack: number;
  defense: number;
  score: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  isAlive: boolean;
  shield: boolean;
  shieldTimer: number;
  isInvisible: boolean;
  invisTimer: number;
  respawnTimer: number;
  timeSinceLastDamage: number;
  regenTimer: number;
  primaryCooldown: number;
  secondaryCooldown: number;
  tacticalCooldown: number;
  ultimateCooldown: number;
  lastProcessedInputSeq: number;
  pendingInputs: ClientInputPacket[];
  lastHeartbeat: number;
  animState: "idle" | "move" | "attack" | "hit" | "death";
}

export interface ServerProjectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
  type: string;
}

export interface ServerGameEvent {
  id: string;
  tick: number;
  timestamp: number;
  type: "damage" | "kill" | "respawn" | "wall_hit" | "action";
  targetId?: string;
  sourceId?: string;
  damage?: number;
  x: number;
  y: number;
  color?: string;
  actionType?: string;
}

export interface ServerSnapshot {
  serverTick: number;
  timestamp: number;
  players: Record<string, {
    id: string;
    userId: string;
    username: string;
    characterSlug: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: number;
    health: number;
    maxHealth: number;
    score: number;
    kills: number;
    deaths: number;
    isAlive: boolean;
    shield: boolean;
    animState: string;
  }>;
  projectiles: ServerProjectile[];
}

export class ServerGameRoom {
  public roomCode: string;
  public arena: ArenaConfig;
  public serverTick: number = 0;
  public startTime: number = Date.now();
  public lastSimulatedTime: number = Date.now();

  private players: Map<string, ServerPlayer> = new Map();
  private projectiles: Map<string, ServerProjectile> = new Map();
  private events: ServerGameEvent[] = [];
  private eventCounter: number = 0;
  private projectileCounter: number = 0;
  private disconnectedPlayerIds: Set<string> = new Set();
  private recentSnapshots: ServerSnapshot[] = [];

  constructor(roomCode: string, arenaId: string = "cyber_grid") {
    this.roomCode = roomCode.toUpperCase();
    this.arena = ARENAS[arenaId] || ARENAS.cyber_grid;
    this.lastSimulatedTime = Date.now();
  }

  // ─── Player Management ───────────────────────────────────────────────────

  public addOrUpdatePlayer(
    userId: string,
    username: string,
    characterSlug: string
  ): ServerPlayer {
    this.disconnectedPlayerIds.delete(userId);
    let player = this.players.get(userId);

    if (!player) {
      const charDef =
        CHARACTER_DATA.find((c) => c.slug === characterSlug) || CHARACTER_DATA[0];
      const spawnIdx = this.players.size % this.arena.spawnPoints.length;
      const spawn = this.arena.spawnPoints[spawnIdx];

      player = {
        id: userId,
        userId,
        username: username || "Player",
        characterSlug: charDef.slug,
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        facing: 0,
        radius: 24,
        health: charDef.stats.health,
        maxHealth: charDef.stats.health,
        speed: charDef.stats.speed * 32, // base speed multiplier
        attack: charDef.stats.attack,
        defense: charDef.stats.defense,
        score: 0,
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        isAlive: true,
        shield: false,
        shieldTimer: 0,
        isInvisible: false,
        invisTimer: 0,
        respawnTimer: 0,
        timeSinceLastDamage: 0,
        regenTimer: 0,
        primaryCooldown: 0,
        secondaryCooldown: 0,
        tacticalCooldown: 0,
        ultimateCooldown: 0,
        lastProcessedInputSeq: 0,
        pendingInputs: [],
        lastHeartbeat: Date.now(),
        animState: "idle",
      };
      this.players.set(userId, player);
    } else {
      player.lastHeartbeat = Date.now();
      if (username) player.username = username;
    }

    return player;
  }

  public enqueueInputs(userId: string, inputs: ClientInputPacket[]): void {
    const player = this.players.get(userId);
    if (!player || !Array.isArray(inputs)) return;

    player.lastHeartbeat = Date.now();

    // Sort inputs by sequence and append only newer inputs
    for (const input of inputs) {
      if (
        input &&
        typeof input.seq === "number" &&
        input.seq > player.lastProcessedInputSeq
      ) {
        // Prevent duplicate input seqs in buffer
        if (!player.pendingInputs.some((i) => i.seq === input.seq)) {
          player.pendingInputs.push(input);
        }
      }
    }

    // Keep pending input buffer bounded
    if (player.pendingInputs.length > 60) {
      player.pendingInputs = player.pendingInputs.slice(-60);
    }
  }

  // ─── Authoritative Simulation Step ───────────────────────────────────────

  /**
   * Advances simulation up to targetTime in deterministic SERVER_TICK_DT increments.
   */
  public stepSimulation(targetTime: number = Date.now()): void {
    const elapsed = (targetTime - this.lastSimulatedTime) / 1000;
    // Cap ticks per step to prevent spiral of death on long pauses
    const maxTicks = 10;
    const ticksToSimulate = Math.min(
      Math.floor(elapsed / SERVER_TICK_DT),
      maxTicks
    );

    for (let t = 0; t < ticksToSimulate; t++) {
      this.tick(SERVER_TICK_DT);
      this.lastSimulatedTime += SERVER_TICK_DT * 1000;
    }

    // If clock drift is still large, sync lastSimulatedTime
    if (targetTime - this.lastSimulatedTime > SERVER_TICK_DT * 1000 * 2) {
      this.lastSimulatedTime = targetTime;
    }
  }

  /**
   * Fixed-timestep authoritative tick
   */
  private tick(dt: number): void {
    this.serverTick++;
    const now = Date.now();

    // ── 1. Simulate Players ────────────────────────────────────────────────
    for (const player of this.players.values()) {
      // Check inactivity
      if (now - player.lastHeartbeat > PLAYER_TIMEOUT_MS) {
        this.disconnectedPlayerIds.add(player.id);
        this.players.delete(player.id);
        continue;
      }

      // Decrement timers
      player.primaryCooldown = Math.max(0, player.primaryCooldown - dt);
      player.secondaryCooldown = Math.max(0, player.secondaryCooldown - dt);
      player.tacticalCooldown = Math.max(0, player.tacticalCooldown - dt);
      player.ultimateCooldown = Math.max(0, player.ultimateCooldown - dt);

      if (player.shield) {
        player.shieldTimer = Math.max(0, player.shieldTimer - dt);
        if (player.shieldTimer <= 0) player.shield = false;
      }

      if (player.isInvisible) {
        player.invisTimer = Math.max(0, player.invisTimer - dt);
        if (player.invisTimer <= 0) player.isInvisible = false;
      }

      // Handle Respawn
      if (!player.isAlive) {
        player.respawnTimer = Math.max(0, player.respawnTimer - dt);
        if (player.respawnTimer <= 0) {
          this.respawnPlayer(player);
        }
        continue; // Dead players don't move or attack
      }

      // Process Player Inputs
      if (player.pendingInputs.length > 0) {
        // Drain inputs
        while (player.pendingInputs.length > 0) {
          const input = player.pendingInputs.shift()!;
          player.lastProcessedInputSeq = input.seq;
          this.applyPlayerInput(player, input, dt);
        }
      } else {
        // No input this tick: apply friction and movement
        player.x += player.vx * dt;
        player.y += player.vy * dt;
        player.vx *= 0.88;
        player.vy *= 0.88;
      }

      // Enforce Wall Collisions
      this.resolvePlayerWallCollisions(player);

      // Enforce Arena Boundaries
      const clamped = clampToBounds(
        player.x,
        player.y,
        player.radius,
        this.arena.width,
        this.arena.height
      );
      player.x = clamped.x;
      player.y = clamped.y;

      // Out-of-combat Health Regeneration
      // If no damage taken for 3.5s, regenerate 10% max HP per second
      if (player.health < player.maxHealth) {
        player.timeSinceLastDamage += dt;
        if (player.timeSinceLastDamage >= 3.5) {
          player.regenTimer += dt;
          if (player.regenTimer >= 1.0) {
            player.regenTimer = 0;
            const heal = Math.max(1, Math.round(player.maxHealth * 0.1));
            player.health = Math.min(player.maxHealth, player.health + heal);
          }
        }
      } else {
        player.timeSinceLastDamage = 0;
        player.regenTimer = 0;
      }

      // Update animation state
      const spd = Math.hypot(player.vx, player.vy);
      player.animState = spd > 15 ? "move" : "idle";
    }

    // ── 2. Simulate Projectiles with Swept Continuous Collision ───────────────
    for (const [projId, proj] of this.projectiles) {
      const prevX = proj.x;
      const prevY = proj.y;

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;

      if (proj.life <= 0) {
        this.projectiles.delete(projId);
        continue;
      }

      // Collect candidate collisions along trajectory (ax,ay) -> (bx,by)
      type HitCandidate = {
        t: number;
        type: "wall" | "player";
        targetPlayer?: ServerPlayer;
        wall?: ArenaWall;
      };
      const candidates: HitCandidate[] = [];

      // Check walls
      for (const wall of this.arena.walls) {
        const t = sweepSegmentVsAABB(
          prevX,
          prevY,
          proj.x,
          proj.y,
          proj.radius,
          wall.x,
          wall.y,
          wall.width,
          wall.height
        );
        if (t !== null) {
          candidates.push({ t, type: "wall", wall });
        }
      }

      // Check players (except projectile owner)
      for (const target of this.players.values()) {
        if (!target.isAlive || target.id === proj.ownerId) continue;
        const t = sweepSegmentVsCircle(
          prevX,
          prevY,
          proj.x,
          proj.y,
          target.x,
          target.y,
          target.radius + proj.radius
        );
        if (t !== null) {
          candidates.push({ t, type: "player", targetPlayer: target });
        }
      }

      if (candidates.length === 0) continue;

      // FIRST COLLISION WINS along the trajectory!
      candidates.sort((a, b) => a.t - b.t);
      const firstHit = candidates[0];

      const impactX = prevX + (proj.x - prevX) * firstHit.t;
      const impactY = prevY + (proj.y - prevY) * firstHit.t;

      if (firstHit.type === "wall") {
        // Blocked by wall: destroy projectile, deal ZERO damage
        this.addEvent({
          type: "wall_hit",
          sourceId: proj.ownerId,
          x: impactX,
          y: impactY,
          color: proj.color,
        });
        this.projectiles.delete(projId);
      } else if (firstHit.type === "player" && firstHit.targetPlayer) {
        // Hit player: apply authoritative damage!
        const target = firstHit.targetPlayer;
        const owner = this.players.get(proj.ownerId);

        // Defense mitigation
        const reduction = Math.min(0.7, (target.defense || 0) * 0.02);
        let dmg = Math.max(1, Math.round(proj.damage * (1 - reduction)));

        // Shield absorption (60% damage reduction if shield active)
        if (target.shield) {
          dmg = Math.max(1, Math.round(dmg * 0.4));
        }

        target.health = Math.max(0, target.health - dmg);
        target.timeSinceLastDamage = 0;
        target.regenTimer = 0;

        if (owner) {
          owner.damageDealt += dmg;
        }

        this.addEvent({
          type: "damage",
          targetId: target.id,
          sourceId: proj.ownerId,
          damage: dmg,
          x: impactX,
          y: impactY,
          color: proj.color,
        });

        // Check Kill
        if (target.health <= 0) {
          target.isAlive = false;
          target.deaths++;
          target.respawnTimer = 3.0; // 3 second respawn
          target.animState = "death";

          if (owner) {
            owner.kills++;
            owner.score += 100;
          }

          this.addEvent({
            type: "kill",
            targetId: target.id,
            sourceId: proj.ownerId,
            x: target.x,
            y: target.y,
          });
        }

        this.projectiles.delete(projId);
      }
    }

    // ── 3. Record Snapshot for Reconciliation & Interpolation ────────────────
    this.recordSnapshot();

    // Clean old events (keep only last 4 seconds)
    const cutoff = now - 4000;
    this.events = this.events.filter((e) => e.timestamp >= cutoff);
  }

  // ─── Input & Ability Handling ────────────────────────────────────────────

  private applyPlayerInput(
    player: ServerPlayer,
    input: ClientInputPacket,
    dt: number
  ): void {
    let dx = 0;
    let dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) rightWalk: dx += 1;

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      player.vx += dx * player.speed * 0.15;
      player.vy += dy * player.speed * 0.15;
    }

    // Cap velocity
    const currentSpeed = Math.hypot(player.vx, player.vy);
    if (currentSpeed > player.speed) {
      player.vx = (player.vx / currentSpeed) * player.speed;
      player.vy = (player.vy / currentSpeed) * player.speed;
    }

    // Facing angle: prioritize aiming towards world cursor
    if (input.isMouseAiming && (input.worldAimX !== 0 || input.worldAimY !== 0)) {
      player.facing = Math.atan2(
        input.worldAimY - player.y,
        input.worldAimX - player.x
      );
    } else if (typeof input.facing === "number") {
      player.facing = input.facing;
    } else if (len > 0) {
      player.facing = Math.atan2(dy, dx);
    }

    // Move
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Apply friction
    player.vx *= 0.88;
    player.vy *= 0.88;

    // Process Ability Trigger
    if (input.action) {
      this.handlePlayerAction(player, input.action);
    }
  }

  private handlePlayerAction(
    player: ServerPlayer,
    action: { type: string; timestamp: number }
  ): void {
    const char =
      CHARACTER_DATA.find((c) => c.slug === player.characterSlug) ||
      CHARACTER_DATA[0];

    if (action.type === "primary" && player.primaryCooldown <= 0) {
      const ability = char.abilities.primary;
      player.primaryCooldown = ability.cooldown;

      const speed =
        player.characterSlug === "volt"
          ? 540
          : player.characterSlug === "titan"
          ? 420
          : 470;
      const radius =
        player.characterSlug === "titan"
          ? 11
          : player.characterSlug === "blaze"
          ? 10
          : 8;
      const spawnDist = player.radius + 8;

      const pId = `proj_${player.id}_${++this.projectileCounter}`;
      this.projectiles.set(pId, {
        id: pId,
        ownerId: player.id,
        x: player.x + Math.cos(player.facing) * spawnDist,
        y: player.y + Math.sin(player.facing) * spawnDist,
        vx: Math.cos(player.facing) * speed,
        vy: Math.sin(player.facing) * speed,
        damage: ability.damage + player.attack * 0.3,
        radius,
        life: (ability.range || 700) / speed,
        maxLife: (ability.range || 700) / speed,
        color: char.accentColor || char.color,
        type: "primary",
      });

      this.addEvent({
        type: "action",
        sourceId: player.id,
        actionType: "primary",
        x: player.x,
        y: player.y,
      });
    } else if (action.type === "secondary" && player.secondaryCooldown <= 0) {
      const ability = char.abilities.secondary;
      player.secondaryCooldown = ability.cooldown;

      if (ability.type === "dash" || player.characterSlug === "volt") {
        const dashDist = player.characterSlug === "volt" ? 360 : 320;
        player.x += Math.cos(player.facing) * dashDist;
        player.y += Math.sin(player.facing) * dashDist;
        this.resolvePlayerWallCollisions(player);
        this.addEvent({
          type: "action",
          sourceId: player.id,
          actionType: "dash",
          x: player.x,
          y: player.y,
        });
      } else if (player.characterSlug === "phantom") {
        player.isInvisible = true;
        player.invisTimer = 3.5;
        this.addEvent({
          type: "action",
          sourceId: player.id,
          actionType: "stealth",
          x: player.x,
          y: player.y,
        });
      } else if (player.characterSlug === "titan" || ability.type === "buff") {
        player.shield = true;
        player.shieldTimer = 4.0;
        this.addEvent({
          type: "action",
          sourceId: player.id,
          actionType: "shield",
          x: player.x,
          y: player.y,
        });
      }
    } else if (action.type === "ultimate" && player.ultimateCooldown <= 0) {
      const ability = char.abilities.ultimate;
      player.ultimateCooldown = ability.cooldown;

      if (ability.type === "aoe") {
        // AoE explosion around player
        const aoeRadius = ability.range || 160;
        for (const target of this.players.values()) {
          if (!target.isAlive || target.id === player.id) continue;
          const dist = Math.hypot(target.x - player.x, target.y - player.y);
          if (dist <= aoeRadius + target.radius) {
            const dmg = Math.max(1, Math.round(ability.damage * (1 - (target.defense || 0) * 0.02)));
            target.health = Math.max(0, target.health - dmg);
            target.timeSinceLastDamage = 0;
            player.damageDealt += dmg;

            this.addEvent({
              type: "damage",
              targetId: target.id,
              sourceId: player.id,
              damage: dmg,
              x: target.x,
              y: target.y,
              color: char.accentColor,
            });

            if (target.health <= 0) {
              target.isAlive = false;
              target.deaths++;
              target.respawnTimer = 3.0;
              player.kills++;
              player.score += 100;
              this.addEvent({
                type: "kill",
                targetId: target.id,
                sourceId: player.id,
                x: target.x,
                y: target.y,
              });
            }
          }
        }
        this.addEvent({
          type: "action",
          sourceId: player.id,
          actionType: "ultimate",
          x: player.x,
          y: player.y,
        });
      }
    }
  }

  // ─── Wall Collisions & Respawn ────────────────────────────────────────────

  private resolvePlayerWallCollisions(player: ServerPlayer): void {
    for (const wall of this.arena.walls) {
      const closestX = Math.max(wall.x, Math.min(player.x, wall.x + wall.width));
      const closestY = Math.max(wall.y, Math.min(player.y, wall.y + wall.height));
      const distX = player.x - closestX;
      const distY = player.y - closestY;
      const distSq = distX * distX + distY * distY;

      if (distSq < player.radius * player.radius && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const overlap = player.radius - dist;
        player.x += (distX / dist) * overlap;
        player.y += (distY / dist) * overlap;
      }
    }
  }

  private respawnPlayer(player: ServerPlayer): void {
    const spawnIdx = Math.floor(Math.random() * this.arena.spawnPoints.length);
    const spawn = this.arena.spawnPoints[spawnIdx];
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.health = player.maxHealth;
    player.isAlive = true;
    player.animState = "idle";
    player.shield = false;
    player.isInvisible = false;
    player.timeSinceLastDamage = 0;
    player.regenTimer = 0;

    this.addEvent({
      type: "respawn",
      targetId: player.id,
      x: player.x,
      y: player.y,
    });
  }

  private addEvent(ev: Omit<ServerGameEvent, "id" | "tick" | "timestamp">): void {
    this.events.push({
      id: `ev_${++this.eventCounter}`,
      tick: this.serverTick,
      timestamp: Date.now(),
      ...ev,
    });
  }

  private recordSnapshot(): void {
    const playersObj: ServerSnapshot["players"] = {};
    for (const [id, p] of this.players) {
      playersObj[id] = {
        id: p.id,
        userId: p.userId,
        username: p.username,
        characterSlug: p.characterSlug,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        vx: Math.round(p.vx * 10) / 10,
        vy: Math.round(p.vy * 10) / 10,
        facing: Math.round(p.facing * 1000) / 1000,
        health: p.health,
        maxHealth: p.maxHealth,
        score: p.score,
        kills: p.kills,
        deaths: p.deaths,
        isAlive: p.isAlive,
        shield: p.shield,
        animState: p.animState,
      };
    }

    const snap: ServerSnapshot = {
      serverTick: this.serverTick,
      timestamp: Date.now(),
      players: playersObj,
      projectiles: Array.from(this.projectiles.values()),
    };

    this.recentSnapshots.push(snap);
    if (this.recentSnapshots.length > 60) {
      this.recentSnapshots.shift();
    }
  }

  // ─── Snapshot Export for Client Sync ─────────────────────────────────────

  public getSnapshotForPlayer(userId: string, lastKnownTick: number = 0) {
    const localPlayer = this.players.get(userId);
    const otherPlayers: Array<ServerPlayer & { lastProcessedInputSeq: number }> =
      [];

    for (const [pid, p] of this.players) {
      if (pid !== userId) {
        otherPlayers.push(p);
      }
    }

    const recentEvents = this.events.filter((e) => e.tick > lastKnownTick);

    return {
      success: true,
      serverTick: this.serverTick,
      serverTime: Date.now(),
      lastProcessedInputSeq: localPlayer ? localPlayer.lastProcessedInputSeq : 0,
      localPlayer: localPlayer
        ? {
            id: localPlayer.id,
            userId: localPlayer.userId,
            username: localPlayer.username,
            characterSlug: localPlayer.characterSlug,
            x: localPlayer.x,
            y: localPlayer.y,
            vx: localPlayer.vx,
            vy: localPlayer.vy,
            facing: localPlayer.facing,
            health: localPlayer.health,
            maxHealth: localPlayer.maxHealth,
            score: localPlayer.score,
            kills: localPlayer.kills,
            deaths: localPlayer.deaths,
            isAlive: localPlayer.isAlive,
            shield: localPlayer.shield,
            primaryCooldown: localPlayer.primaryCooldown,
            secondaryCooldown: localPlayer.secondaryCooldown,
            tacticalCooldown: localPlayer.tacticalCooldown,
            ultimateCooldown: localPlayer.ultimateCooldown,
          }
        : null,
      players: otherPlayers.map((p) => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        characterSlug: p.characterSlug,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        facing: p.facing,
        health: p.health,
        maxHealth: p.maxHealth,
        score: p.score,
        kills: p.kills,
        deaths: p.deaths,
        isAlive: p.isAlive,
        shield: p.shield,
        animState: p.animState,
      })),
      projectiles: Array.from(this.projectiles.values()),
      events: recentEvents,
      disconnectedPlayers: Array.from(this.disconnectedPlayerIds),
    };
  }
}

// ─── Global Server Room Registry (In-Memory Singleton) ───────────────────────

declare global {
  // eslint-disable-next-line no-var
  var _arenaxServerRooms: Map<string, ServerGameRoom> | undefined;
}

if (!global._arenaxServerRooms) {
  global._arenaxServerRooms = new Map();
}

export function getOrCreateServerRoom(
  roomCode: string,
  arenaId: string = "cyber_grid"
): ServerGameRoom {
  const code = roomCode.toUpperCase();
  const rooms = global._arenaxServerRooms!;
  if (!rooms.has(code)) {
    rooms.set(code, new ServerGameRoom(code, arenaId));
  }
  return rooms.get(code)!;
}

export function removeServerRoom(roomCode: string): void {
  const code = roomCode.toUpperCase();
  global._arenaxServerRooms?.delete(code);
}
