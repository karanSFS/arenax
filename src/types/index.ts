// ═══════════════════════════════════════════
// ARENAX - Global TypeScript Types
// ═══════════════════════════════════════════

// ─── User & Auth ───────────────────────────
export interface IUser {
  _id: string;
  email: string;
  username: string;
  passwordHash?: string;
  role: "player" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

// ─── Profile ────────────────────────────────
export interface IProfile {
  _id: string;
  userId: string;
  displayName: string;
  avatar: string;
  bio: string;
  level: number;
  xp: number;
  coins: number;
  rating: number;
  rank: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Character ──────────────────────────────
export type CharacterRole = "melee" | "ranged" | "tank" | "assassin";

export interface CharacterStats {
  health: number;
  speed: number;
  attack: number;
  defense: number;
}

export interface CharacterAbility {
  name: string;
  description: string;
  damage: number;
  cooldown: number;
  type: "melee" | "projectile" | "aoe" | "buff" | "dash";
  range: number;
}

export interface ICharacter {
  _id: string;
  name: string;
  slug: string;
  description: string;
  role: CharacterRole;
  stats: CharacterStats;
  abilities: {
    primary: CharacterAbility;
    secondary: CharacterAbility;
    ultimate: CharacterAbility;
  };
  color: string;
  accentColor: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Room ────────────────────────────────────
export type RoomStatus =
  | "WAITING"
  | "READY"
  | "STARTING"
  | "IN_PROGRESS"
  | "FINISHED"
  | "CANCELLED";

export type GameMode = "QUICK_MATCH" | "PRIVATE_ROOM" | "PRACTICE";

export type ArenaId = "cyber_grid" | "void_core" | "industrial_zone";

export interface RoomPlayer {
  userId: string;
  username: string;
  characterId: string;
  isReady: boolean;
  isHost: boolean;
}

export interface IRoom {
  _id: string;
  roomCode: string;
  hostUserId: string;
  players: RoomPlayer[];
  gameMode: GameMode;
  arena: ArenaId;
  status: RoomStatus;
  maxPlayers: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
}

// ─── Match ───────────────────────────────────
export type MatchStatus = "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";

export interface IMatch {
  _id: string;
  roomId: string;
  gameMode: GameMode;
  arena: ArenaId;
  players: string[];
  winnerId?: string;
  status: MatchStatus;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  createdAt: Date;
}

// ─── Match Player ────────────────────────────
export type MatchResult = "WIN" | "LOSS" | "DRAW";

export interface IMatchPlayer {
  _id: string;
  matchId: string;
  userId: string;
  characterId: string;
  kills: number;
  deaths: number;
  damage: number;
  score: number;
  xpEarned: number;
  coinsEarned: number;
  result: MatchResult;
  createdAt: Date;
}

// ─── Player Stats ────────────────────────────
export interface IPlayerStats {
  _id: string;
  userId: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  damageTaken: number;
  winRate: number;
  kdRatio: number;
  rating: number;
  updatedAt: Date;
}

// ─── Inventory ───────────────────────────────
export type ItemType = "character" | "skin" | "emote" | "banner" | "effect";

export interface InventoryItem {
  itemId: string;
  itemType: ItemType;
  quantity: number;
  unlockedAt: Date;
}

export interface IInventory {
  _id: string;
  userId: string;
  items: InventoryItem[];
}

// ─── Transactions ────────────────────────────
export interface IXPTransaction {
  _id: string;
  userId: string;
  amount: number;
  reason: string;
  matchId?: string;
  createdAt: Date;
}

export type CoinTransactionType = "EARN" | "SPEND" | "REWARD" | "REFUND";

export interface ICoinTransaction {
  _id: string;
  userId: string;
  amount: number;
  type: CoinTransactionType;
  reason: string;
  matchId?: string;
  createdAt: Date;
}

// ─── Leaderboard ─────────────────────────────
export interface ILeaderboard {
  _id: string;
  userId: string;
  rating: number;
  wins: number;
  kills: number;
  level: number;
  weeklyRating: number;
  updatedAt: Date;
}

export interface LeaderboardEntry extends ILeaderboard {
  rank: number;
  username: string;
  displayName: string;
  avatar: string;
}

// ─── Achievement ─────────────────────────────
export interface IAchievement {
  _id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  requirement: {
    type: "wins" | "kills" | "matches" | "level" | "rating";
    value: number;
  };
  xpReward: number;
  coinReward: number;
  createdAt: Date;
}

export interface IPlayerAchievement {
  _id: string;
  userId: string;
  achievementId: string;
  unlockedAt: Date;
}

// ─── Player Settings ─────────────────────────
export interface IPlayerSettings {
  _id: string;
  userId: string;
  audio: {
    master: number;
    music: number;
    sfx: number;
  };
  graphics: {
    quality: "low" | "medium" | "high";
    particles: boolean;
    screenShake: boolean;
  };
  controls: {
    layout: "default" | "alternative";
  };
  gameplay: {
    vibration: boolean;
    screenShake: boolean;
    showDamageNumbers: boolean;
  };
  updatedAt: Date;
}

// ─── Game Engine Types ────────────────────────
export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameState {
  phase: "lobby" | "countdown" | "playing" | "finished";
  timeRemaining: number;
  players: Record<string, GamePlayer>;
  projectiles: GameProjectile[];
  particles: GameParticle[];
}

export interface GamePlayer {
  id: string;
  userId: string;
  username: string;
  characterId: string;
  position: Vector2;
  velocity: Vector2;
  facing: number;
  health: number;
  maxHealth: number;
  kills: number;
  deaths: number;
  score: number;
  isAlive: boolean;
  respawnTimer: number;
  abilities: {
    primary: { lastUsed: number; cooldown: number };
    secondary: { lastUsed: number; cooldown: number };
    ultimate: { lastUsed: number; cooldown: number };
  };
}

export interface GameProjectile {
  id: string;
  ownerId: string;
  position: Vector2;
  velocity: Vector2;
  damage: number;
  radius: number;
  lifetime: number;
  color: string;
}

export interface GameParticle {
  id: string;
  position: Vector2;
  velocity: Vector2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
}

// ─── API Response Types ───────────────────────
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// ─── Socket Events ────────────────────────────
export interface ClientToServerEvents {
  "room:join": (data: { roomId: string; userId: string }) => void;
  "room:leave": (data: { roomId: string; userId: string }) => void;
  "player:ready": (data: { roomId: string; userId: string; characterId: string }) => void;
  "game:input": (data: { roomId: string; input: PlayerInput }) => void;
  "game:ability": (data: { roomId: string; ability: "primary" | "secondary" | "ultimate"; targetX: number; targetY: number }) => void;
  "game:attack": (data: { roomId: string; targetX: number; targetY: number }) => void;
}

export interface ServerToClientEvents {
  "room:updated": (room: IRoom) => void;
  "game:start": (data: { countdown: number }) => void;
  "game:state": (state: GameState) => void;
  "game:event": (event: GameEvent) => void;
  "game:finished": (result: MatchResultData) => void;
  "player:joined": (player: RoomPlayer) => void;
  "player:left": (userId: string) => void;
  "error": (err: { code: string; message: string }) => void;
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  ability1: boolean;
  ability2: boolean;
  ultimate: boolean;
  aimX: number;
  aimY: number;
  sequence: number;
}

export interface GameEvent {
  type: "kill" | "death" | "ability" | "hit" | "levelup";
  data: Record<string, unknown>;
  timestamp: number;
}

export interface MatchResultData {
  matchId: string;
  winnerId: string;
  players: Array<{
    userId: string;
    username: string;
    characterId: string;
    kills: number;
    deaths: number;
    score: number;
    xpEarned: number;
    coinsEarned: number;
    result: MatchResult;
  }>;
}

// ─── Session ──────────────────────────────────
export interface SessionUser {
  id: string;
  email: string;
  username: string;
  role: string;
}
