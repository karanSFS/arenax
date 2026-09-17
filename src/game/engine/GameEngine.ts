// ═══════════════════════════════════════════
// GAME ENGINE
// Main orchestrator: game loop, systems, rendering
// ═══════════════════════════════════════════

import { Player, ProjectileData } from "@/game/entities/Player";
import { Bot, BotDifficulty } from "@/game/ai/BotAI";
import { ParticleSystem } from "@/game/particles/ParticleSystem";
import { KeyboardController, TouchController, InputState } from "@/game/input/InputController";
import { ARENAS, ArenaConfig } from "@/game/maps/Arena";
import { soundManager } from "@/game/audio/SoundManager";

import { sweepSegmentVsAABB, sweepSegmentVsCircle } from "@/game/physics/sweptCollision";
import { ClientInputPacket } from "@/game/server/ServerGameRoom";



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
      primary: { cooldown: number; max: number; name?: string };
      secondary: { cooldown: number; max: number; name?: string };
      tactical?: { cooldown: number; max: number; name?: string };
      ultimate: { cooldown: number; max: number; name?: string };
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
  private lastCountdownSecond = 4;
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

  // Multiplayer authoritative sync & prediction
  public isMultiplayer = false;
  private inputSeq = 0;
  private pendingInputsToSync: ClientInputPacket[] = [];
  private unacknowledgedInputs: Array<{
    packet: ClientInputPacket;
    predictedX: number;
    predictedY: number;
    predictedVx: number;
    predictedVy: number;
  }> = [];
  private serverTick = 0;
  private currentPing = 0;
  private seenEventIds: Set<string> = new Set();
  private lastRemoteActionTimestamps: Map<string, number> = new Map();
  private seenRemoteProjectileIds: Set<string> = new Set();

  // Debug overlay (F3 or ` / ~)
  public isDebugOverlay = false;
  private fpsRolling: number[] = [];
  private lastFpsTime = performance.now();
  private currentFPS = 60;

  // Event handlers for clean teardown
  private keydownHandler?: (e: KeyboardEvent) => void;
  private mousedownHandler?: (e: MouseEvent) => void;
  private mouseupHandler?: (e: MouseEvent) => void;
  private contextmenuHandler?: (e: MouseEvent) => void;

  // RAF handle
  private rafHandle = 0;
  private lastTime = 0;
  private isDestroyed = false;

  // Screen size
  private viewW: number;
  private viewH: number;
  private hudTimer = 0;

  constructor(
    canvas: HTMLCanvasElement,
    arenaId: string,
    callbacks: GameEngineCallbacks = {}
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.arena = ARENAS[arenaId] || ARENAS.cyber_grid;
    this.particles = new ParticleSystem(150);
    this.callbacks = callbacks;
    this.viewW = canvas.width;
    this.viewH = canvas.height;
    this.keyboard = new KeyboardController(canvas);

    // Mouse click attack
    this.mousedownHandler = () => this.keyboard.setMouseClick(true);
    this.mouseupHandler = () => this.keyboard.setMouseClick(false);
    this.contextmenuHandler = (e) => e.preventDefault();

    canvas.addEventListener("mousedown", this.mousedownHandler);
    canvas.addEventListener("mouseup", this.mouseupHandler);
    canvas.addEventListener("contextmenu", this.contextmenuHandler);

    // Development Debug Mode Toggle (F3 or ` / ~)
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === "F3" || e.key === "`" || e.key === "~") {
        this.isDebugOverlay = !this.isDebugOverlay;
      }
    };
    window.addEventListener("keydown", this.keydownHandler);
  }

  // ─── Setup ─────────────────────────────────────────────────────────────────

  setupLocalPlayer(userId: string, username: string, characterSlug: string, spawnIndex: number = 0) {
    const spawn = this.arena.spawnPoints[spawnIndex % this.arena.spawnPoints.length];
    this.localPlayer = new Player(
      { id: userId, userId, username, characterSlug, isLocal: true },
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
    if (
      this.remotePlayers.has(id) ||
      (this.localPlayer && (this.localPlayer.id === id || this.localPlayer.userId === userId))
    ) {
      return;
    }
    const spawnIdx = (this.remotePlayers.size + 1) % this.arena.spawnPoints.length;
    const spawn = this.arena.spawnPoints[spawnIdx];
    const player = new Player(
      { id, userId, username, characterSlug, isLocal: false },
      x !== undefined && x > 0 ? x : spawn.x,
      y !== undefined && y > 0 ? y : spawn.y
    );
    this.remotePlayers.set(id, player);
  }

  updateRemotePlayer(id: string, data: any) {
    if (this.localPlayer && (this.localPlayer.id === id || this.localPlayer.userId === data.userId)) {
      return;
    }
    const player = this.remotePlayers.get(id);
    if (!player) {
      if (data.userId && data.username && data.characterSlug) {
        this.addRemotePlayer(id, data.userId, data.username, data.characterSlug, data.x, data.y);
      }
      return;
    }
    // Clamp incoming coords to arena bounds (prevents OOB desync on stale packets)
    const clampedData = { ...data };
    if (typeof clampedData.x === "number") {
      clampedData.x = Math.max(24, Math.min(this.arena.width - 24, clampedData.x));
    }
    if (typeof clampedData.y === "number") {
      clampedData.y = Math.max(24, Math.min(this.arena.height - 24, clampedData.y));
    }
    player.setRemoteState(clampedData);


    // Trigger visual effects and audio if the remote player performed an ability
    if (data.action && data.action.timestamp) {
      const lastTs = this.lastRemoteActionTimestamps.get(id) || 0;
      if (data.action.timestamp > lastTs) {
        this.lastRemoteActionTimestamps.set(id, data.action.timestamp);
        if (data.action.type === "dash") {
          this.particles.explosion(player.x, player.y, player.accentColor, 14);
          soundManager.playDash();
        } else if (data.action.type === "shield") {
          soundManager.playShield();
        } else if (data.action.type === "ultimate" || data.action.type === "aoe") {
          const ax = data.action.x || player.x;
          const ay = data.action.y || player.y;
          this.particles.explosion(ax, ay, player.accentColor, 30);
          this.screenShake = 0.65;
          soundManager.playUltimate();
        }
      }
    }
  }

  removeRemotePlayer(id: string) {
    this.remotePlayers.delete(id);
    this.lastRemoteActionTimestamps.delete(id);
  }

  public spawnRemoteProjectiles(incoming: any[]) {
    if (!Array.isArray(incoming)) return;
    for (const p of incoming) {
      if (!p || !p.id) continue;
      // Never spawn our own projectiles
      if (this.localPlayer && (p.ownerId === this.localPlayer.id || p.ownerId === this.localPlayer.userId)) continue;
      if (this.seenRemoteProjectileIds.has(p.id)) continue;
      this.seenRemoteProjectileIds.add(p.id);

      // Spawn projectile with remote trajectory
      this.spawnProjectile(p, true);

      // Trigger audio & muzzle sparks at firing position
      const owner = this.getPlayerById(p.ownerId) || Array.from(this.remotePlayers.values()).find(rp => rp.userId === p.ownerId || rp.id === p.ownerId);
      const charSlug = owner?.characterSlug || "volt";
      soundManager.playAttack(charSlug);
      this.particles.sparks(p.x, p.y, p.color || "#00f5ff", 6);
    }

    if (this.seenRemoteProjectileIds.size > 800) {
      this.seenRemoteProjectileIds.clear();
    }
  }

  public getAndClearPendingInputs(): ClientInputPacket[] {
    const list = [...this.pendingInputsToSync];
    this.pendingInputsToSync = [];
    return list;
  }

  public setPing(pingMs: number) {
    this.currentPing = pingMs;
  }

  public getServerTick(): number {
    return this.serverTick;
  }

  public setMultiplayer(isMulti: boolean) {
    this.isMultiplayer = isMulti;
  }

  public reconcileServerState(serverPlayer: any, lastProcessedInputSeq: number) {
    if (!this.localPlayer || !serverPlayer) return;

    // Prune acknowledged inputs
    this.unacknowledgedInputs = this.unacknowledgedInputs.filter(
      (item) => item.packet.seq > lastProcessedInputSeq
    );

    // Sync authoritative stats
    this.localPlayer.health = serverPlayer.health;
    this.localPlayer.maxHealth = serverPlayer.maxHealth;
    this.localPlayer.score = serverPlayer.score;
    this.localPlayer.kills = serverPlayer.kills;
    this.localPlayer.deaths = serverPlayer.deaths;
    this.localPlayer.isAlive = serverPlayer.isAlive;
    if (serverPlayer.shield !== undefined) {
      this.localPlayer.shield = serverPlayer.shield;
    }

    // Check discrepancy with authoritative position
    const errX = serverPlayer.x - this.localPlayer.x;
    const errY = serverPlayer.y - this.localPlayer.y;
    const errDist = Math.hypot(errX, errY);

    // If server correction is needed (> 3px error):
    // Replay unacknowledged inputs on top of authoritative server state!
    if (errDist > 3) {
      this.localPlayer.x = serverPlayer.x;
      this.localPlayer.y = serverPlayer.y;
      this.localPlayer.vx = serverPlayer.vx;
      this.localPlayer.vy = serverPlayer.vy;

      for (const item of this.unacknowledgedInputs) {
        this.localPlayer.applyInput(
          {
            up: item.packet.up,
            down: item.packet.down,
            left: item.packet.left,
            right: item.packet.right,
            aimX: item.packet.worldAimX - this.cameraX,
            aimY: item.packet.worldAimY - this.cameraY,
            isMouseAiming: item.packet.isMouseAiming,
            worldAimX: item.packet.worldAimX,
            worldAimY: item.packet.worldAimY,
          } as any,
          this.cameraX,
          this.cameraY
        );
        this.localPlayer.update(
          item.packet.dt || 0.016,
          this.arena.walls,
          this.arena.width,
          this.arena.height
        );
      }
    }
  }

  public ingestServerSnapshot(snapshot: any) {
    if (!snapshot) return;

    if (typeof snapshot.serverTick === "number") {
      this.serverTick = snapshot.serverTick;
    }

    // 1. Reconcile local player
    const localData = snapshot.localPlayer || snapshot.data?.localPlayer;
    const lastSeq =
      snapshot.lastProcessedInputSeq || snapshot.data?.lastProcessedInputSeq || 0;
    if (localData) {
      this.reconcileServerState(localData, lastSeq);
    }

    // 2. Buffer snapshots for remote players
    const playersList = snapshot.players || snapshot.data?.players;
    const now = Date.now();
    if (Array.isArray(playersList)) {
      for (const p of playersList) {
        const pid = p.userId || p.id;
        if (
          !pid ||
          (this.localPlayer &&
            (pid === this.localPlayer.userId || pid === this.localPlayer.id))
        ) {
          continue;
        }

        let rp = this.remotePlayers.get(pid);
        if (!rp) {
          this.addRemotePlayer(
            pid,
            p.userId || pid,
            p.username,
            p.characterSlug,
            p.x,
            p.y
          );
          rp = this.remotePlayers.get(pid);
        }

        if (rp) {
          rp.pushRemoteSnapshot({
            tick: snapshot.serverTick || 0,
            time: now,
            x: p.x,
            y: p.y,
            vx: p.vx,
            vy: p.vy,
            facing: p.facing,
            health: p.health,
            maxHealth: p.maxHealth,
            isAlive: p.isAlive,
            shield: !!p.shield,
            animState: p.animState || "idle",
          });
        }
      }
    }

    // 3. Process Authoritative Events (damage numbers, sparks, kills, actions)
    const events = snapshot.events || snapshot.data?.events;
    if (Array.isArray(events)) {
      for (const ev of events) {
        if (!ev || !ev.id || this.seenEventIds.has(ev.id)) continue;
        this.seenEventIds.add(ev.id);

        if (ev.type === "damage") {
          this.addDamageNumber(ev.x, ev.y, ev.damage, ev.color || "#ff2d55");
          this.particles.hit(ev.x, ev.y, ev.color || "#ff2d55", 10);
          if (
            this.localPlayer &&
            (ev.targetId === this.localPlayer.userId ||
              ev.sourceId === this.localPlayer.userId)
          ) {
            soundManager.playHit();
            this.screenShake = 0.3;
          }
        } else if (ev.type === "wall_hit") {
          this.particles.sparks(ev.x, ev.y, ev.color || "#4c8dff", 6);
        } else if (ev.type === "kill") {
          const killer = this.getPlayerById(ev.sourceId);
          const victim = this.getPlayerById(ev.targetId);
          if (killer && victim) {
            this.handleKill(killer, victim);
          }
        } else if (ev.type === "action") {
          const p = this.getPlayerById(ev.sourceId);
          if (p && !p.isLocal) {
            if (ev.actionType === "dash") {
              this.particles.explosion(p.x, p.y, p.accentColor, 14);
              soundManager.playDash();
            } else if (ev.actionType === "shield") {
              soundManager.playShield();
            } else if (ev.actionType === "ultimate") {
              this.particles.explosion(ev.x, ev.y, p.accentColor, 30);
              this.screenShake = 0.65;
              soundManager.playUltimate();
            }
          }
        }
      }

      if (this.seenEventIds.size > 1000) {
        this.seenEventIds.clear();
      }
    }

    // 4. Authoritative Projectiles Sync
    const projectilesList = snapshot.projectiles || snapshot.data?.projectiles;
    if (Array.isArray(projectilesList)) {
      this.syncServerProjectiles(projectilesList);
    }

    // 5. Remove disconnected players
    const disconnected =
      snapshot.disconnectedPlayers || snapshot.data?.disconnectedPlayers;
    if (Array.isArray(disconnected)) {
      for (const pid of disconnected) {
        if (pid !== this.localPlayer?.userId) {
          this.removeRemotePlayer(pid);
        }
      }
    }
  }

  private syncServerProjectiles(serverProjs: any[]) {
    const activeIds = new Set<string>();
    for (const p of serverProjs) {
      if (!p || !p.id) continue;
      activeIds.add(p.id);

      const existing = this.projectiles.get(p.id);
      if (!existing) {
        this.projectiles.set(p.id, {
          id: p.id,
          ownerId: p.ownerId,
          x: p.x,
          y: p.y,
          vx: p.vx,
          vy: p.vy,
          damage: p.damage,
          radius: p.radius || 8,
          life: p.life,
          maxLife: p.maxLife || p.life,
          color: p.color || "#4c8dff",
          type: (p.type || "primary") as any,
        });
        if (p.ownerId !== this.localPlayer?.userId) {
          const owner = this.getPlayerById(p.ownerId);
          soundManager.playAttack(owner?.characterSlug || "volt");
        }
      } else {
        existing.x = p.x;
        existing.y = p.y;
        existing.vx = p.vx;
        existing.vy = p.vy;
        existing.life = p.life;
      }
    }

    if (this.isMultiplayer) {
      for (const [id, proj] of this.projectiles) {
        if (proj.ownerId !== this.localPlayer?.userId && !activeIds.has(id)) {
          this.projectiles.delete(id);
        }
      }
    }
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

      // Calculate rolling FPS for debug overlay
      const now = performance.now();
      const frameDelta = (now - this.lastFpsTime) / 1000;
      this.lastFpsTime = now;
      if (frameDelta > 0) {
        this.fpsRolling.push(1 / frameDelta);
        if (this.fpsRolling.length > 30) this.fpsRolling.shift();
        this.currentFPS = Math.round(
          this.fpsRolling.reduce((a, b) => a + b, 0) / this.fpsRolling.length
        );
      }

      this.update(dt);
      this.render();

      this.loop();
    });
  }

  private update(dt: number) {
    // ── Countdown ────────────────────────────────────────────
    if (this.phase === "countdown") {
      this.countdownTimer -= dt;
      const currentSec = Math.ceil(this.countdownTimer);
      if (currentSec < this.lastCountdownSecond) {
        this.lastCountdownSecond = currentSec;
        if (currentSec > 0) {
          soundManager.playCountdownTick(currentSec);
        }
      }
      if (this.countdownTimer <= 0) {
        this.phase = "playing";
        this.matchTimer = 180;
        soundManager.playBattleStart();
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
    const localScreenPos = this.localPlayer
      ? { x: this.localPlayer.x - this.cameraX, y: this.localPlayer.y - this.cameraY }
      : undefined;
    const kb = this.keyboard.getState(localScreenPos);
    const touch = this.touchController.getState();
    const isTouchAim = touch.aimX !== 0 || touch.aimY !== 0;
    const input: InputState = {
      up: kb.up || touch.up,
      down: kb.down || touch.down,
      left: kb.left || touch.left,
      right: kb.right || touch.right,
      attack: kb.attack || touch.attack,
      ability1: kb.ability1 || touch.ability1,
      ability2: kb.ability2 || touch.ability2,
      ultimate: kb.ultimate || touch.ultimate,
      aimX: isTouchAim ? touch.aimX : kb.aimX,
      aimY: isTouchAim ? touch.aimY : kb.aimY,
      isMouseAiming: isTouchAim || kb.isMouseAiming,
      sequence: kb.sequence + touch.sequence,
    };

    // ── Local player ─────────────────────────────────────────
    if (this.localPlayer) {
      if (this.localPlayer.isAlive) {
        // Explicit WORLD coordinates for physics and aiming (independent of camera drift)
        const worldAimX = input.aimX + this.cameraX;
        const worldAimY = input.aimY + this.cameraY;

        this.localPlayer.applyInput(
          {
            ...input,
            worldAimX,
            worldAimY,
          } as any,
          this.cameraX,
          this.cameraY
        );

        let currentAction: ClientInputPacket["action"] = undefined;
        if (input.attack) {
          currentAction = { type: "primary", timestamp: Date.now() };
        } else if (input.ability1) {
          currentAction = { type: "secondary", timestamp: Date.now() };
        } else if (input.ability2) {
          currentAction = { type: "tactical", timestamp: Date.now() };
        } else if (input.ultimate) {
          currentAction = { type: "ultimate", timestamp: Date.now() };
        }

        this.handleAttackInput(input);

        // Queue input packet for server synchronization & local reconciliation
        if (this.isMultiplayer) {
          const seq = ++this.inputSeq;
          const packet: ClientInputPacket = {
            seq,
            up: input.up,
            down: input.down,
            left: input.left,
            right: input.right,
            worldAimX,
            worldAimY,
            facing: this.localPlayer.facing,
            isMouseAiming: input.isMouseAiming,
            action: currentAction,
            dt,
          };

          this.pendingInputsToSync.push(packet);
          this.unacknowledgedInputs.push({
            packet,
            predictedX: this.localPlayer.x,
            predictedY: this.localPlayer.y,
            predictedVx: this.localPlayer.vx,
            predictedVy: this.localPlayer.vy,
          });

          if (this.unacknowledgedInputs.length > 120) {
            this.unacknowledgedInputs.shift();
          }
        }
      } else if (this.localPlayer.respawnTimer <= 0 && !this.isMultiplayer) {
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

    // ── Remote players (Snapshot Interpolation) ────────────────
    const renderTime = Date.now() - 100; // 100ms interpolation buffer
    for (const rp of this.remotePlayers.values()) {
      rp.updateRemote(dt, renderTime);
    }

    // ── Projectiles (Continuous Swept-Circle Collision — prevents tunneling) ─
    for (const [pid, proj] of this.projectiles) {
      // Save previous position before integration
      const prevX = proj.x;
      const prevY = proj.y;

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;
      this.particles.projectileTrail(proj.x, proj.y, proj.color);

      if (proj.life <= 0) {
        this.projectiles.delete(pid);
        continue;
      }

      // First-collision-wins: collect all potential hits with parametric t
      type HitCandidate = { t: number; type: "wall" | "player"; target?: Player };
      const hits: HitCandidate[] = [];

      // Wall swept collision (segment vs expanded AABB)
      for (const wall of this.arena.walls) {
        const t = sweepSegmentVsAABB(
          prevX, prevY, proj.x, proj.y, proj.radius,
          wall.x, wall.y, wall.width, wall.height
        );
        if (t !== null) hits.push({ t, type: "wall" });
      }

      // Player swept collision (local / bot practice mode only; in multiplayer, damage is server-authoritative)
      if (!this.isMultiplayer) {
        const targets = [
          ...(this.localPlayer ? [this.localPlayer] : []),
          ...this.bots,
        ];
        for (const target of targets) {
          if (target.id === proj.ownerId || target.userId === proj.ownerId || !target.isAlive) continue;
          const t = sweepSegmentVsCircle(
            prevX, prevY, proj.x, proj.y,
            target.x, target.y, target.radius + proj.radius
          );
          if (t !== null) hits.push({ t, type: "player", target });
        }
      }

      if (hits.length === 0) continue; // No collision this frame

      // Sort by t — earliest collision along trajectory wins!
      hits.sort((a, b) => a.t - b.t);
      const first = hits[0];

      // Impact position along the trajectory
      const impactX = prevX + (proj.x - prevX) * first.t;
      const impactY = prevY + (proj.y - prevY) * first.t;

      if (first.type === "wall") {
        // Bullet hit wall: spark and destroy projectile. Deal ZERO damage!
        this.particles.sparks(impactX, impactY, proj.color, 5);
        this.projectiles.delete(pid);
      } else if (first.type === "player" && first.target && !this.isMultiplayer) {
        const target = first.target;
        const owner = this.getPlayerById(proj.ownerId);
        if (owner) {
          const dmg = target.takeDamage(proj.damage);
          owner.damageDealt += dmg;
          this.addDamageNumber(impactX, impactY, dmg, proj.color);
          this.particles.hit(impactX, impactY, proj.color, 10);
          this.screenShake = 0.3;

          if (target.isLocal || owner.isLocal) {
            soundManager.playHit();
          }

          if (!target.isAlive) {
            this.handleKill(owner, target);
          }
        }
        this.projectiles.delete(pid);
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

    // ── HUD update (Throttled to 10Hz to prevent React Virtual DOM diffing churn) ──
    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.emitHUDUpdate();
    }
  }

  public emitHUDUpdate() {
    if (!this.localPlayer) return;
    const cds = this.localPlayer.getAbilityCooldowns();
    this.callbacks.onHUDUpdate?.({
      localPlayer: {
        health: this.localPlayer.health,
        maxHealth: this.localPlayer.maxHealth,
        kills: this.localPlayer.kills,
        deaths: this.localPlayer.deaths,
        score: this.localPlayer.score,
        abilities: {
          primary: { cooldown: cds.primary.current, max: cds.primary.max, name: cds.primary.name },
          secondary: { cooldown: cds.secondary.current, max: cds.secondary.max, name: cds.secondary.name },
          tactical: { cooldown: cds.tactical.current, max: cds.tactical.max, name: cds.tactical.name },
          ultimate: { cooldown: cds.ultimate.current, max: cds.ultimate.max, name: cds.ultimate.name },
        },
      },
      timeRemaining: Math.max(0, this.matchTimer),
      phase: this.phase,
      killFeed: this.killFeed,
    });
  }

  public triggerAbility(action: "attack" | "ability1" | "ability2" | "ultimate") {
    this.keyboard.triggerAction(action, true);
    setTimeout(() => {
      this.keyboard.triggerAction(action, false);
    }, 120);
  }

  private handleAttackInput(input: InputState) {
    if (!this.localPlayer || !this.localPlayer.isAlive) return;

    // Primary weapon attack (Space / Left Click / On-screen Fire Button)
    if (input.attack) {
      const result = this.localPlayer.activatePrimary();
      if (result?.projectile) {
        this.spawnProjectile(result.projectile);
        soundManager.playAttack(this.localPlayer.characterSlug);
      } else if (result?.damage) {
        this.processMelee(this.localPlayer, result.damage);
        soundManager.playAttack(this.localPlayer.characterSlug);
      }
    }

    // Ability Q (Skill 1: Dash / Shield / Vanish)
    if (input.ability1) {
      const result = this.localPlayer.activateSecondary();
      if (result?.projectile) {
        this.spawnProjectile(result.projectile);
        soundManager.playAttack(this.localPlayer.characterSlug);
      }
      if (result?.dash) {
        this.localPlayer.vx += result.dash.dx;
        this.localPlayer.vy += result.dash.dy;
        this.particles.explosion(this.localPlayer.x, this.localPlayer.y, this.localPlayer.accentColor, 12);
        soundManager.playDash();
      }
      if (result?.shield) {
        soundManager.playShield();
      }
    }

    // Ability E (Skill 2: Tactical Blast / Spread / Stomp)
    if (input.ability2) {
      const result = this.localPlayer.activateTactical();
      if (result?.projectiles) {
        for (const p of result.projectiles) {
          this.spawnProjectile(p);
        }
        soundManager.playAttack(this.localPlayer.characterSlug);
      } else if (result?.projectile) {
        this.spawnProjectile(result.projectile);
        soundManager.playAttack(this.localPlayer.characterSlug);
      } else if (result?.aoe) {
        this.processAOE(this.localPlayer, result.aoe.x, result.aoe.y, result.aoe.radius, result.aoe.damage);
        this.screenShake = 0.45;
        this.particles.explosion(result.aoe.x, result.aoe.y, this.localPlayer.accentColor, 18);
        soundManager.playDash();
      }
    }

    // Ability R (Ultimate Move: Conflagration / Thunderstrike / Meteor / Death Mark)
    if (input.ultimate) {
      const result = this.localPlayer.activateUltimate();
      if (result?.projectile) {
        this.spawnProjectile(result.projectile);
        this.screenShake = 0.6;
        this.particles.explosion(this.localPlayer.x, this.localPlayer.y, this.localPlayer.accentColor, 20);
        soundManager.playUltimate();
      }
      if (result?.aoe) {
        this.processAOE(this.localPlayer, result.aoe.x, result.aoe.y, result.aoe.radius, result.aoe.damage);
        this.screenShake = 0.85;
        this.particles.explosion(result.aoe.x, result.aoe.y, this.localPlayer.accentColor, 32);
        soundManager.playUltimate();
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

        if (attacker.isLocal && !target.isLocal) {
          this.recordDamageEvent(target.userId || target.id, dmg);
        }

        if (target.isLocal || attacker.isLocal) {
          soundManager.playHit();
        }

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

        if (attacker.isLocal && !target.isLocal) {
          this.recordDamageEvent(target.userId || target.id, dmg);
        }

        if (!target.isAlive) {
          this.handleKill(attacker, target);
        }
      }
    }
  }

  private spawnProjectile(proj: Omit<ProjectileData, "id"> & { id?: string }, isFromRemote = false): string {
    const id = proj.id || `proj-${++this.projectileIdCounter}-${Date.now()}`;
    const fullProj = { ...proj, id };
    this.projectiles.set(id, fullProj);
    return id;
  }

  private handleKill(killer: Player, victim: Player) {
    killer.kills++;
    killer.score += 100;
    this.particles.death(victim.x, victim.y, victim.color);
    this.screenShake = 0.6;

    if (killer.isLocal) {
      soundManager.playKill();
    }
    if (victim.isLocal) {
      soundManager.playDeath();
    }

    this.killFeed.unshift({
      killer: killer.username,
      victim: victim.username,
      timestamp: Date.now(),
    });
    if (this.killFeed.length > 5) this.killFeed.pop();

    this.callbacks.onKill?.(killer, victim);
    this.callbacks.onDeath?.(victim);

    // Check if match should end
    const allPlayers = [
      ...(this.localPlayer ? [this.localPlayer] : []),
      ...this.bots,
      ...Array.from(this.remotePlayers.values()),
    ];
    const maxKills = allPlayers.reduce((m, p) => Math.max(m, p.kills), 0);
    if (maxKills >= 5) {
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
    if (this.localPlayer?.id === id || this.localPlayer?.userId === id) return this.localPlayer;
    const remote = this.remotePlayers.get(id);
    if (remote) return remote;
    for (const rp of this.remotePlayers.values()) {
      if (rp.userId === id) return rp;
    }
    return this.bots.find((b) => b.id === id || b.userId === id);
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

    // Grid (Viewport culled & single stroke batch)
    this.renderGrid(ctx, camX, camY);

    // Walls (Viewport culled)
    this.renderWalls(ctx, camX, camY);

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

    // Projectiles with high-energy glowing streak tails (Optimized, no shadowBlur)
    const viewRight = camX + canvas.width;
    const viewBottom = camY + canvas.height;

    for (const proj of this.projectiles.values()) {
      if (
        proj.x < camX - 30 ||
        proj.x > viewRight + 30 ||
        proj.y < camY - 30 ||
        proj.y > viewBottom + 30
      ) {
        continue;
      }

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

      // Outer glow halo
      ctx.fillStyle = `${proj.color}55`;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius + 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, Math.max(1.5, proj.radius * 0.65), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Particles (Rendered with viewport culling, zero shadowBlur)
    this.particles.render(ctx, 0, 0, canvas.width, canvas.height);

    // Damage numbers (Crisp stroke outline, no shadowBlur)
    for (const dn of this.damageNumbers) {
      const alpha = dn.life / 0.8;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${20 + (1 - alpha) * 8}px 'Orbitron', monospace`;
      ctx.textAlign = "center";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
      ctx.lineWidth = 3;
      ctx.strokeText(`-${dn.value}`, dn.x, dn.y);
      ctx.fillStyle = dn.color;
      ctx.fillText(`-${dn.value}`, dn.x, dn.y);
      ctx.restore();
    }

    ctx.restore();

    // Countdown overlay
    if (this.phase === "countdown") {
      this.renderCountdown(ctx);
    }

    // Development Debug Mode Overlay (F3 or ` / ~)
    if (this.isDebugOverlay) {
      this.renderDebugOverlay();
    }
  }

  private renderGrid(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    const gridSize = 40;
    ctx.save();
    ctx.strokeStyle = this.arena.gridColor;
    ctx.lineWidth = 1;

    // Viewport-culled grid lines: draw ONLY visible lines
    const startX = Math.max(0, Math.floor(camX / gridSize) * gridSize);
    const endX = Math.min(this.arena.width, Math.ceil((camX + this.canvas.width) / gridSize) * gridSize);
    const startY = Math.max(0, Math.floor(camY / gridSize) * gridSize);
    const endY = Math.min(this.arena.height, Math.ceil((camY + this.canvas.height) / gridSize) * gridSize);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Refined arena border — semi-transparent, clean
    ctx.strokeStyle = this.arena.accentColor + "60";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, this.arena.width - 2, this.arena.height - 2);

    ctx.restore();
  }

  private renderWalls(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    ctx.save();
    const viewRight = camX + this.canvas.width;
    const viewBottom = camY + this.canvas.height;

    for (const wall of this.arena.walls) {
      if (
        wall.x + wall.width < camX ||
        wall.x > viewRight ||
        wall.y + wall.height < camY ||
        wall.y > viewBottom
      ) {
        continue;
      }

      // Premium dark fill — Graphite/Obsidian
      ctx.fillStyle = "#141820";
      ctx.fillRect(wall.x, wall.y, wall.width, wall.height);

      // Subtle top-lit surface bevel
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(wall.x, wall.y, wall.width, 2);
      ctx.fillRect(wall.x, wall.y, 2, wall.height);

      // Refined accent border
      ctx.strokeStyle = this.arena.accentColor + "99";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.width - 1, wall.height - 1);
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

    // 2. Tactical Player Indicator
    if (player.isLocal) {
      // Rotating selection arc — electric blue
      const rot = now * 0.002;
      ctx.save();
      ctx.strokeStyle = "rgba(76, 141, 255, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, radius + 7, rot, rot + Math.PI * 1.3);
      ctx.stroke();
      // Aim pip
      const tipDist = radius + 11;
      ctx.fillStyle = "#4C8DFF";
      ctx.beginPath();
      ctx.arc(x + Math.cos(facing) * tipDist, y + Math.sin(facing) * tipDist, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Enemy / ally indicator ring — steel gray
      ctx.save();
      ctx.strokeStyle = "rgba(141, 153, 168, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
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
      ctx.strokeStyle = "#4C8DFF";
      ctx.lineWidth = 1.5;
      ctx.fillRect(8, 5, 26, 4);
      ctx.strokeRect(8, 5, 26, 4);

      // Energy capacitor rings
      ctx.fillStyle = "#4C8DFF";
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

    // Health bar fill — premium palette
    const hpColor = player.healthPercent > 0.55
      ? "#36B37E"  // emerald — healthy
      : player.healthPercent > 0.28
      ? "#F0B429"  // amber — caution
      : "#E05A5A"; // refined red — critical
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, Math.max(0, barW * player.healthPercent), barH);

    // Player Name Tag
    ctx.save();
    ctx.font = "bold 9px 'Orbitron', monospace";
    ctx.textAlign = "center";

    if (player.isLocal) {
      ctx.fillStyle = "#4C8DFF"; // electric blue
      ctx.fillText(`▶ ${player.username}`, x, barY - 5);
    } else {
      ctx.fillStyle = "#A7ADB5"; // steel gray
      ctx.fillText(player.username, x, barY - 5);
    }
    ctx.restore();
  }

  private renderDebugOverlay() {
    const ctx = this.ctx;
    ctx.save();

    // 1. Draw Obstacle Collision Boxes in World Space
    ctx.strokeStyle = "rgba(0, 255, 128, 0.85)";
    ctx.lineWidth = 1.5;
    for (const wall of this.arena.walls) {
      const sx = wall.x - this.cameraX;
      const sy = wall.y - this.cameraY;
      ctx.strokeRect(sx, sy, wall.width, wall.height);
      ctx.fillStyle = "rgba(0, 255, 128, 0.08)";
      ctx.fillRect(sx, sy, wall.width, wall.height);
    }

    // 2. Draw Hitboxes (Circles) for Players
    const all = [
      ...(this.localPlayer ? [this.localPlayer] : []),
      ...this.bots,
      ...Array.from(this.remotePlayers.values()),
    ];
    for (const p of all) {
      const sx = p.x - this.cameraX;
      const sy = p.y - this.cameraY;

      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.strokeStyle = p.isLocal ? "#00ffcc" : "#ff3366";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Facing vector
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(
        sx + Math.cos(p.facing) * (p.radius + 15),
        sy + Math.sin(p.facing) * (p.radius + 15)
      );
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Coordinate label
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px monospace";
      ctx.fillText(
        `${Math.round(p.x)},${Math.round(p.y)}`,
        sx - 20,
        sy - p.radius - 5
      );
    }

    // 3. Draw Projectile Trajectories
    ctx.strokeStyle = "rgba(255, 255, 0, 0.8)";
    ctx.lineWidth = 1.5;
    for (const proj of this.projectiles.values()) {
      const sx = proj.x - this.cameraX;
      const sy = proj.y - this.cameraY;

      ctx.beginPath();
      ctx.arc(sx, sy, proj.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Velocity line
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + proj.vx * 0.08, sy + proj.vy * 0.08);
      ctx.stroke();
    }

    // 4. HUD Debug Panel (Screen Space)
    ctx.restore();
    ctx.save();
    const panelW = 240;
    const panelH = 150;
    const px = this.viewW - panelW - 16;
    const py = 70;

    ctx.fillStyle = "rgba(8, 10, 16, 0.88)";
    ctx.strokeStyle = "rgba(0, 245, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeRect(px, py, panelW, panelH);

    ctx.fillStyle = "#00f5ff";
    ctx.font = "bold 11px monospace";
    ctx.fillText("ARENAX MULTIPLAYER DEBUG", px + 10, py + 18);

    ctx.fillStyle = "#ffffff";
    ctx.font = "11px monospace";
    ctx.fillText(`FPS: ${this.currentFPS}`, px + 10, py + 38);
    ctx.fillText(`Ping: ${this.currentPing} ms`, px + 10, py + 54);
    ctx.fillText(`Server Tick: ${this.serverTick}`, px + 10, py + 70);
    ctx.fillText(`Local Seq: ${this.inputSeq}`, px + 10, py + 86);
    if (this.localPlayer) {
      ctx.fillText(
        `Pos: ${Math.round(this.localPlayer.x)}, ${Math.round(this.localPlayer.y)}`,
        px + 10,
        py + 102
      );
      ctx.fillText(
        `HP: ${this.localPlayer.health}/${this.localPlayer.maxHealth}`,
        px + 10,
        py + 118
      );
    }
    ctx.fillText(
      `Remotes: ${this.remotePlayers.size} | Proj: ${this.projectiles.size}`,
      px + 10,
      py + 134
    );

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

      ctx.fillStyle = "#4C8DFF";
      ctx.font = `bold ${150}px 'Orbitron', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 1 - progress * 0.8;
      ctx.fillText(countdown.toString(), 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = "#E05A5A";
      ctx.font = `bold 100px 'Orbitron', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("FIGHT!", canvas.width / 2, canvas.height / 2);
    }
    ctx.restore();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  private pendingDamageEvents: Array<{ targetId: string; damage: number; timestamp: number }> = [];

  recordDamageEvent(targetId: string, damage: number) {
    this.pendingDamageEvents.push({ targetId, damage, timestamp: Date.now() });
  }

  getAndClearPendingDamageEvents() {
    const events = [...this.pendingDamageEvents];
    this.pendingDamageEvents = [];
    return events;
  }

  applyIncomingDamage(damage: number) {
    if (!this.localPlayer || !this.localPlayer.isAlive) return;
    this.localPlayer.takeDamage(damage);
    soundManager.playHit();
    this.screenShake = 0.4;
    this.particles.hit(this.localPlayer.x, this.localPlayer.y, "#ff2d78", 12);
    this.addDamageNumber(this.localPlayer.x, this.localPlayer.y - 20, damage, "#ff2d78");
    this.emitHUDUpdate();
  }

  destroy() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.rafHandle);

    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
    }
    if (this.mousedownHandler) {
      this.canvas.removeEventListener("mousedown", this.mousedownHandler);
    }
    if (this.mouseupHandler) {
      this.canvas.removeEventListener("mouseup", this.mouseupHandler);
    }
    if (this.contextmenuHandler) {
      this.canvas.removeEventListener("contextmenu", this.contextmenuHandler);
    }

    this.keyboard.destroy();
    this.particles.clear();
    this.remotePlayers.clear();
    this.projectiles.clear();
    this.pendingInputsToSync = [];
    this.unacknowledgedInputs = [];
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
