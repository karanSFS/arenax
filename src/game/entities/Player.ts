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
    if (!collidedY) this.y = newY;

    // Arena bounds
    this.x = Math.max(this.radius + 30, Math.min(arenaW - this.radius - 30, this.x));
    this.y = Math.max(this.radius + 30, Math.min(arenaH - this.radius - 30, this.y));

    // Friction
    this.vx *= 0.85;
    this.vy *= 0.85;

    // Animation state
    if (Math.abs(this.vx) > 5 || Math.abs(this.vy) > 5) {
      this.animState = "move";
    } else if (this.animState === "move") {
      this.animState = "idle";
    }

    this.animTimer += dt;
  }

  updateRemote(dt: number) {
    // Smooth interpolation for remote players
    this.x += (this.targetX - this.x) * this.lerpFactor;
    this.y += (this.targetY - this.y) * this.lerpFactor;
    this.primaryCooldown = Math.max(0, this.primaryCooldown - dt);
    this.secondaryCooldown = Math.max(0, this.secondaryCooldown - dt);
    this.ultimateCooldown = Math.max(0, this.ultimateCooldown - dt);
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
    if (data.x !== undefined) this.targetX = data.x;
    if (data.y !== undefined) this.targetY = data.y;
    if (data.vx !== undefined) this.vx = data.vx;
    if (data.vy !== undefined) this.vy = data.vy;
    if (data.facing !== undefined) this.facing = data.facing;
    if (data.health !== undefined) this.health = data.health;
    if (data.maxHealth !== undefined) this.maxHealth = data.maxHealth;
    if (data.score !== undefined) this.score = data.score;
    if (data.kills !== undefined) this.kills = data.kills;
    if (data.deaths !== undefined) this.deaths = data.deaths;
    if (data.isAlive !== undefined) this.isAlive = data.isAlive;
  }

  applyInput(input: { up: boolean; down: boolean; left: boolean; right: boolean; aimX: number; aimY: number }, camX: number, camY: number) {
    let dx = 0, dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
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

    // Facing angle
    const screenX = this.x - camX;
    const screenY = this.y - camY;
    if (Math.abs(input.aimX) > 0.001 || Math.abs(input.aimY) > 0.001) {
      this.facing = Math.atan2(input.aimY - screenY, input.aimX - screenX);
    } else if (Math.hypot(this.vx, this.vy) > 10) {
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

    if (ability.type === "projectile") {
      const speed = 450;
      return {
        projectile: {
          ownerId: this.id,
          x: this.x,
          y: this.y,
          vx: Math.cos(this.facing) * speed,
          vy: Math.sin(this.facing) * speed,
          damage: ability.damage + this.attack * 0.3,
          radius: 8,
          life: ability.range / speed,
          maxLife: ability.range / speed,
          color: this.accentColor,
          type: "primary",
        },
      };
    }

    if (ability.type === "melee") {
      return { damage: ability.damage + this.attack * 0.3 };
    }

    return null;
  }

  activateSecondary(): { dash?: { dx: number; dy: number }; shield?: boolean; projectile?: Omit<ProjectileData, "id"> } | null {
    if (this.secondaryCooldown > 0 || !this.isAlive) return null;
    const char = CHARACTER_DATA.find((c) => c.slug === this.characterSlug) || CHARACTER_DATA[0];
    const ability = char.abilities.secondary;
    this.secondaryCooldown = ability.cooldown;

    if (ability.type === "dash") {
      return {
        dash: {
          dx: Math.cos(this.facing) * 300,
          dy: Math.sin(this.facing) * 300,
        },
      };
    }
    if (ability.type === "buff" && this.characterSlug === "phantom") {
      this.isInvisible = true;
      this.invisTimer = 3;
      return { shield: true };
    }
    if (ability.type === "buff") {
      // Titan shield - briefly reduce damage taken
      return { shield: true };
    }
    if (ability.type === "projectile") {
      const speed = 350;
      return {
        projectile: {
          ownerId: this.id,
          x: this.x,
          y: this.y,
          vx: Math.cos(this.facing) * speed,
          vy: Math.sin(this.facing) * speed,
          damage: ability.damage + this.attack * 0.5,
          radius: 12,
          life: ability.range / speed,
          maxLife: ability.range / speed,
          color: this.accentColor,
          type: "secondary",
        },
      };
    }
    return null;
  }

  activateUltimate(): { projectile?: Omit<ProjectileData, "id">; aoe?: { x: number; y: number; radius: number; damage: number } } | null {
    if (this.ultimateCooldown > 0 || !this.isAlive) return null;
    const char = CHARACTER_DATA.find((c) => c.slug === this.characterSlug) || CHARACTER_DATA[0];
    const ability = char.abilities.ultimate;
    this.ultimateCooldown = ability.cooldown;

    if (ability.type === "aoe") {
      return {
        aoe: {
          x: this.x + Math.cos(this.facing) * 100,
          y: this.y + Math.sin(this.facing) * 100,
          radius: ability.range,
          damage: ability.damage + this.attack,
        },
      };
    }

    if (ability.type === "dash") {
      const speed = 500;
      return {
        projectile: {
          ownerId: this.id,
          x: this.x,
          y: this.y,
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

    return null;
  }

  get healthPercent() {
    return this.health / this.maxHealth;
  }

  getAbilityCooldowns() {
    const char = CHARACTER_DATA.find((c) => c.slug === this.characterSlug) || CHARACTER_DATA[0];
    return {
      primary: { current: this.primaryCooldown, max: char.abilities.primary.cooldown },
      secondary: { current: this.secondaryCooldown, max: char.abilities.secondary.cooldown },
      ultimate: { current: this.ultimateCooldown, max: char.abilities.ultimate.cooldown },
    };
  }
}
