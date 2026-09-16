// ═══════════════════════════════════════════
// PLAYER ENTITY
// Core player logic with movement, combat, abilities
// ═══════════════════════════════════════════

import { ArenaWall } from "@/game/maps/Arena";
import { CHARACTER_DATA } from "@/game/characters/CharacterConfig";

export interface PlayerData {
  id: string;
  userId: string;
  username: string;
  characterSlug: string;
  isLocal: boolean;
}

export interface ProjectileData {
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
  type: "primary" | "secondary" | "ultimate";
}

export class Player {
  // Identity
  id: string;
  userId: string;
  username: string;
  characterSlug: string;
  isLocal: boolean;

  // Position & physics
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  facing = 0; // angle in radians
  radius = 24;

  // Stats from character config
  maxHealth: number;
  health: number;
  speed: number;
  attack: number;
  defense: number;
  color: string;
  accentColor: string;

  // Combat state
  kills = 0;
  deaths = 0;
  score = 0;
  damageDealt = 0;
  isAlive = true;
  respawnTimer = 0;
  respawnDelay = 3; // seconds

  // Ability cooldowns (in seconds, countdown to 0)
  primaryCooldown = 0;
  secondaryCooldown = 0;
  tacticalCooldown = 0;
  ultimateCooldown = 0;

  // Animations
  animState: "idle" | "move" | "attack" | "hit" | "death" = "idle";
  animTimer = 0;
  hitFlash = 0;
  isInvisible = false;
  invisTimer = 0;

  // Interpolation (for remote players)
  targetX = 0;
  targetY = 0;
  lerpFactor = 0.15;

  // Out-of-combat health regeneration & damage locking
  timeSinceLastDamage = 0;
  regenTimer = 0;
  lastDamageTakenTime = 0;

  constructor(data: PlayerData, spawnX: number, spawnY: number) {
    this.id = data.id;
    this.userId = data.userId;
    this.username = data.username;
    this.characterSlug = data.characterSlug;
    this.isLocal = data.isLocal;
    this.x = spawnX;
    this.y = spawnY;
    this.targetX = spawnX;
    this.targetY = spawnY;

    const char = CHARACTER_DATA.find((c) => c.slug === data.characterSlug) || CHARACTER_DATA[0];
    this.maxHealth = char.stats.health;
    this.health = char.stats.health;
    this.speed = char.stats.speed * 36; // pixels/sec
    this.attack = char.stats.attack;
    this.defense = char.stats.defense;
    this.color = char.color;
    this.accentColor = char.accentColor;
  }

  update(dt: number, walls: ArenaWall[], arenaW: number, arenaH: number) {
    if (!this.isAlive) {
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      return;
    }

    // Cooldowns
    this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);
    this.tacticalCooldown = Math.max(0, this.tacticalCooldown - dt);
    this.ultimateCooldown = Math.max(0, this.ultimateCooldown - dt);

    // Hit flash decay
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);

    // Invisibility timer
    if (this.isInvisible) {
      this.invisTimer = Math.max(0, this.invisTimer - dt);
      if (this.invisTimer <= 0) this.isInvisible = false;
    }

    // Movement & wall collision
    const newX = this.x + this.vx * dt;
    const newY = this.y + this.vy * dt;

    let collidedX = false;
    let collidedY = false;

    for (const wall of walls) {
      // X axis
      if (
        newX + this.radius > wall.x &&
        newX - this.radius < wall.x + wall.width &&
        this.y + this.radius > wall.y &&
        this.y - this.radius < wall.y + wall.height
      ) {
        collidedX = true;
      }
      // Y axis
      if (
        this.x + this.radius > wall.x &&
        this.x - this.radius < wall.x + wall.width &&
        newY + this.radius > wall.y &&
        newY - this.radius < wall.y + wall.height
      ) {
        collidedY = true;
      }
    }

    if (!collidedX) this.x = newX;
    else this.vx = 0;

    if (!collidedY) this.y = newY;
    else this.vy = 0;

    // Arena boundary clamp
    this.x = Math.max(this.radius, Math.min(arenaW - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(arenaH - this.radius, this.y));

    // Friction
    this.vx *= 0.88;
    this.vy *= 0.88;

    // Out-of-combat health regeneration:
    // If player avoids taking damage for 3.5 seconds, start regenerating 10% max HP per second!
    if (this.health < this.maxHealth) {
      this.timeSinceLastDamage += dt;
      if (this.timeSinceLastDamage >= 3.5) {
        this.regenTimer += dt;
        if (this.regenTimer >= 1.0) {
          this.regenTimer = 0;
          const healAmount = Math.max(1, Math.round(this.maxHealth * 0.10));
          this.health = Math.min(this.maxHealth, this.health + healAmount);
        }
      }
    } else {
      this.timeSinceLastDamage = 0;
      this.regenTimer = 0;
    }

    // Anim state
    const speed = Math.hypot(this.vx, this.vy);
    if (this.hitFlash > 0.5) {
      this.animState = "hit";
    } else if (speed > 15) {
      this.animState = "move";
    } else {
      this.animState = "idle";
    }

    this.animTimer += dt;
  }

  updateRemote(dt: number) {
    // 1. Dead reckoning prediction: extrapolate target position based on remote velocity
    this.targetX += this.vx * dt;
    this.targetY += this.vy * dt;

    // 2. Smooth continuous glide towards predicted target position (exponential decay)
    const smoothFactor = Math.min(1, dt * 16);
    this.x += (this.targetX - this.x) * smoothFactor;
    this.y += (this.targetY - this.y) * smoothFactor;

    // 3. Update animation state & walking cycle for remote fighter
    const speed = Math.hypot(this.vx, this.vy);
    if (this.hitFlash > 0.5) {
      this.animState = "hit";
    } else if (speed > 15) {
      this.animState = "move";
    } else {
      this.animState = "idle";
    }
    this.animTimer += dt;

    this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);
    this.tacticalCooldown = Math.max(0, this.tacticalCooldown - dt);
    this.ultimateCooldown = Math.max(0, this.ultimateCooldown - dt);

    // Remote out-of-combat health regeneration
    if (this.isAlive && this.health < this.maxHealth) {
      this.timeSinceLastDamage += dt;
      if (this.timeSinceLastDamage >= 3.5) {
        this.regenTimer += dt;
        if (this.regenTimer >= 1.0) {
          this.regenTimer = 0;
          const heal = Math.max(1, Math.round(this.maxHealth * 0.10));
          this.health = Math.min(this.maxHealth, this.health + heal);
        }
      }
    }
  }

  setRemoteState(data: {
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    facing?: number;
    health?: number;
    maxHealth?: number;
    score?: number;
    kills?: number;
    deaths?: number;
    isAlive?: boolean;
  }) {
    if (data.x !== undefined && data.y !== undefined) {
      const dist = Math.hypot(data.x - this.x, data.y - this.y);
      // Snap instantly if initial spawn or large teleport/respawn (> 280px)
      if (dist > 280 || (this.x === 0 && this.y === 0)) {
        this.x = data.x;
        this.y = data.y;
      }
      this.targetX = data.x;
      this.targetY = data.y;
    }
    if (data.vx !== undefined) this.vx = data.vx;
    if (data.vy !== undefined) this.vy = data.vy;
    if (data.facing !== undefined) this.facing = data.facing;

    // Prevent stale incoming sync packets from instantly reviving/healing someone we just hit!
    if (data.health !== undefined) {
      if (Date.now() - this.lastDamageTakenTime < 1800) {
        this.health = Math.min(this.health, data.health);
      } else {
        this.health = data.health;
      }
    }
    if (data.maxHealth !== undefined) this.maxHealth = data.maxHealth;
    if (data.score !== undefined) this.score = data.score;
    if (data.kills !== undefined) this.kills = data.kills;
    if (data.deaths !== undefined) this.deaths = data.deaths;
    if (data.isAlive !== undefined) this.isAlive = data.isAlive;
  }

  applyInput(
    input: {
      up: boolean;
      down: boolean;
      left: boolean;
      right: boolean;
      aimX: number;
      aimY: number;
      isMouseAiming?: boolean;
    },
    camX: number,
    camY: number
  ) {
    let dx = 0, dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    const len = Math.sqrt(dx * dx + dy * dy);
    const isMoving = len > 0;
    if (isMoving) {
      dx /= len;
      dy /= len;
      this.vx += dx * this.speed * 0.15;
      this.vy += dy * this.speed * 0.15;
    }

    // Cap speed
    const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (spd > this.speed) {
      this.vx = (this.vx / spd) * this.speed;
      this.vy = (this.vy / spd) * this.speed;
    }

    // Facing angle:
    // DUAL CONTROL SCHEME:
    // 1. If mouse is actively aiming, aim precision 360° toward mouse cursor.
    // 2. If user is moving via Arrow keys or WASD, automatically face in movement direction!
    // 3. Otherwise retain last facing direction.
    const screenX = this.x - camX;
    const screenY = this.y - camY;

    if (input.isMouseAiming && (input.aimX !== 0 || input.aimY !== 0)) {
      this.facing = Math.atan2(input.aimY - screenY, input.aimX - screenX);
    } else if (isMoving) {
      this.facing = Math.atan2(dy, dx);
    } else if (Math.hypot(this.vx, this.vy) > 15) {
      this.facing = Math.atan2(this.vy, this.vx);
    }
  }

  takeDamage(amount: number, attackerDefense = 0): number {
    if (!this.isAlive) return 0;
    const reduction = Math.min(0.5, this.defense / 50); // max 50% mitigation
    const actual = Math.max(1, Math.round(amount * (1 - reduction)));
    this.health = Math.max(0, this.health - actual);
    this.hitFlash = 1;
    this.animState = "hit";
    this.timeSinceLastDamage = 0; // Reset out-of-combat timer on hit!
    this.regenTimer = 0;
    this.lastDamageTakenTime = Date.now();

    if (this.health <= 0) {
      this.die();
    }
    return actual;
  }

  die() {
    this.isAlive = false;
    this.health = 0;
    this.animState = "death";
    this.respawnTimer = this.respawnDelay;
    this.deaths++;
  }

  respawn(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.health = this.maxHealth;
    this.isAlive = true;
    this.animState = "idle";
    this.isInvisible = false;
  }

  activatePrimary(): { projectile?: Omit<ProjectileData, "id">; damage?: number } | null {
    if (this.primaryCooldown > 0 || !this.isAlive) return null;
    const char = CHARACTER_DATA.find((c) => c.slug === this.characterSlug) || CHARACTER_DATA[0];
    const ability = char.abilities.primary;
    this.primaryCooldown = ability.cooldown;
    this.animState = "attack";

    // All fighters shoot a primary projectile on Space/Click!
    const speed = this.characterSlug === "volt" ? 540 : this.characterSlug === "titan" ? 420 : 470;
    const radius = this.characterSlug === "titan" ? 11 : this.characterSlug === "blaze" ? 10 : 8;
    const spawnDist = this.radius + 8;

    return {
      projectile: {
        ownerId: this.id,
        x: this.x + Math.cos(this.facing) * spawnDist,
        y: this.y + Math.sin(this.facing) * spawnDist,
        vx: Math.cos(this.facing) * speed,
        vy: Math.sin(this.facing) * speed,
        damage: ability.damage + this.attack * 0.3,
        radius,
        life: (ability.range || 700) / speed,
        maxLife: (ability.range || 700) / speed,
        color: this.accentColor || this.color,
        type: "primary",
      },
    };
  }

  activateSecondary(): { dash?: { dx: number; dy: number }; shield?: boolean; projectile?: Omit<ProjectileData, "id"> } | null {
    if (this.secondaryCooldown > 0 || !this.isAlive) return null;
    const char = CHARACTER_DATA.find((c) => c.slug === this.characterSlug) || CHARACTER_DATA[0];
    const ability = char.abilities.secondary;
    this.secondaryCooldown = ability.cooldown;

    if (ability.type === "dash" || this.characterSlug === "volt") {
      const dashDist = this.characterSlug === "volt" ? 360 : 320;
      return {
        dash: {
          dx: Math.cos(this.facing) * dashDist,
          dy: Math.sin(this.facing) * dashDist,
        },
      };
    }
    if (this.characterSlug === "phantom") {
      this.isInvisible = true;
      this.invisTimer = 3.5;
      return { shield: true };
    }
    if (this.characterSlug === "titan" || ability.type === "buff") {
      return { shield: true };
    }
    return null;
  }

  activateTactical(): {
    projectile?: Omit<ProjectileData, "id">;
    projectiles?: Array<Omit<ProjectileData, "id">>;
    aoe?: { x: number; y: number; radius: number; damage: number };
  } | null {
    if (this.tacticalCooldown > 0 || !this.isAlive) return null;
    const char = CHARACTER_DATA.find((c) => c.slug === this.characterSlug) || CHARACTER_DATA[0];
    const ability = char.abilities.tactical || {
      name: "Tactical",
      description: "Tactical blast",
      type: "projectile",
      damage: 45,
      range: 650,
      cooldown: 5,
    };
    this.tacticalCooldown = ability.cooldown;

    if (this.characterSlug === "blaze") {
      // 3-way spread of fiery thermal projectiles
      const speed = 480;
      const angles = [this.facing - 0.22, this.facing, this.facing + 0.22];
      const projs = angles.map((ang) => ({
        ownerId: this.id,
        x: this.x + Math.cos(ang) * (this.radius + 8),
        y: this.y + Math.sin(ang) * (this.radius + 8),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        damage: 26 + this.attack * 0.25,
        radius: 9,
        life: 1.1,
        maxLife: 1.1,
        color: "#ff4500",
        type: "secondary" as const,
      }));
      return { projectiles: projs };
    }

    if (this.characterSlug === "phantom") {
      // Twin shadow shurikens
      const speed = 560;
      const angles = [this.facing - 0.12, this.facing + 0.12];
      const projs = angles.map((ang) => ({
        ownerId: this.id,
        x: this.x + Math.cos(ang) * (this.radius + 8),
        y: this.y + Math.sin(ang) * (this.radius + 8),
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        damage: 28 + this.attack * 0.3,
        radius: 8,
        life: 1.1,
        maxLife: 1.1,
        color: "#d040ff",
        type: "secondary" as const,
      }));
      return { projectiles: projs };
    }

    if (this.characterSlug === "titan") {
      // Ground concussion shockwave ring
      return {
        aoe: {
          x: this.x,
          y: this.y,
          radius: 150,
          damage: 48 + this.attack * 0.4,
        },
      };
    }

    // Volt / Default: Arc Shot
    const speed = 640;
    return {
      projectile: {
        ownerId: this.id,
        x: this.x + Math.cos(this.facing) * (this.radius + 10),
        y: this.y + Math.sin(this.facing) * (this.radius + 10),
        vx: Math.cos(this.facing) * speed,
        vy: Math.sin(this.facing) * speed,
        damage: 55 + this.attack * 0.5,
        radius: 12,
        life: 1.2,
        maxLife: 1.2,
        color: this.accentColor || this.color,
        type: "secondary",
      },
    };
  }

  activateUltimate(): { projectile?: Omit<ProjectileData, "id">; aoe?: { x: number; y: number; radius: number; damage: number } } | null {
    if (this.ultimateCooldown > 0 || !this.isAlive) return null;
    const char = CHARACTER_DATA.find((c) => c.slug === this.characterSlug) || CHARACTER_DATA[0];
    const ability = char.abilities.ultimate;
    this.ultimateCooldown = ability.cooldown;

    if (ability.type === "aoe" || this.characterSlug === "titan" || this.characterSlug === "blaze" || this.characterSlug === "volt") {
      return {
        aoe: {
          x: this.x + Math.cos(this.facing) * 60,
          y: this.y + Math.sin(this.facing) * 60,
          radius: ability.range || 170,
          damage: ability.damage + this.attack,
        },
      };
    }

    const speed = 520;
    return {
      projectile: {
        ownerId: this.id,
        x: this.x + Math.cos(this.facing) * (this.radius + 10),
        y: this.y + Math.sin(this.facing) * (this.radius + 10),
        vx: Math.cos(this.facing) * speed,
        vy: Math.sin(this.facing) * speed,
        damage: ability.damage + this.attack * 0.8,
        radius: 20,
        life: 1.2,
        maxLife: 1.2,
        color: this.accentColor,
        type: "ultimate",
      },
    };
  }

  get healthPercent() {
    return this.health / this.maxHealth;
  }

  getAbilityCooldowns() {
    const char = CHARACTER_DATA.find((c) => c.slug === this.characterSlug) || CHARACTER_DATA[0];
    return {
      primary: { current: this.primaryCooldown, max: char.abilities.primary.cooldown, name: char.abilities.primary.name },
      secondary: { current: this.secondaryCooldown, max: char.abilities.secondary.cooldown, name: char.abilities.secondary.name },
      tactical: { current: this.tacticalCooldown, max: (char.abilities.tactical?.cooldown || 5), name: (char.abilities.tactical?.name || "Tactical") },
      ultimate: { current: this.ultimateCooldown, max: char.abilities.ultimate.cooldown, name: char.abilities.ultimate.name },
    };
  }
}
