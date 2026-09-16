// ═══════════════════════════════════════════
// PROGRESSION UTILITIES
// XP, Level calculation, Coin rewards
// ═══════════════════════════════════════════

/**
 * Calculate total XP required to reach a given level.
 * Formula: xp = 500 * (level - 1) + 100 * (level - 1)^2
 * Level 1: 0 XP
 * Level 2: 600 XP
 * Level 3: 1400 XP
 * Level 4: 2400 XP
 * ...
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 500 * n + 100 * n * n;
}

/**
 * Calculate what level a player is at given total XP.
 */
export function levelFromXP(totalXP: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXP) {
    level++;
    if (level >= 100) break; // cap at 100
  }
  return level;
}

/**
 * Get XP progress within current level.
 * Returns { current, required, percentage }
 */
export function xpProgress(totalXP: number): {
  level: number;
  current: number;
  required: number;
  percentage: number;
} {
  const level = levelFromXP(totalXP);
  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  const current = totalXP - currentLevelXP;
  const required = nextLevelXP - currentLevelXP;
  const percentage = Math.min(100, Math.round((current / required) * 100));

  return { level, current, required, percentage };
}

// ─── XP Rewards ───────────────────────────────────────────────────────────────
export const XP_REWARDS = {
  VICTORY: 250,
  LOSS: 80,
  KILL: 20,
  ASSIST: 10,
  FIRST_BLOOD: 50,
  PRACTICE_WIN: 100,
  PRACTICE_LOSS: 40,
} as const;

// ─── Coin Rewards ─────────────────────────────────────────────────────────────
export const COIN_REWARDS = {
  VICTORY: 120,
  LOSS: 40,
  KILL: 10,
  ASSIST: 5,
  FIRST_BLOOD: 25,
  PRACTICE_WIN: 60,
  PRACTICE_LOSS: 20,
} as const;

// ─── Rating Changes ───────────────────────────────────────────────────────────
export const RATING_CHANGES = {
  WIN: 25,
  LOSS: -18,
  DRAW: 0,
} as const;

/**
 * Calculate XP earned from a match result.
 */
export function calculateMatchXP(data: {
  result: "WIN" | "LOSS" | "DRAW";
  kills: number;
  isPractice: boolean;
}): number {
  const { result, kills, isPractice } = data;
  let xp = 0;

  if (isPractice) {
    xp += result === "WIN" ? XP_REWARDS.PRACTICE_WIN : XP_REWARDS.PRACTICE_LOSS;
  } else {
    xp += result === "WIN" ? XP_REWARDS.VICTORY : XP_REWARDS.LOSS;
  }

  xp += kills * XP_REWARDS.KILL;
  return xp;
}

/**
 * Calculate coins earned from a match result.
 */
export function calculateMatchCoins(data: {
  result: "WIN" | "LOSS" | "DRAW";
  kills: number;
  isPractice: boolean;
}): number {
  const { result, kills, isPractice } = data;
  let coins = 0;

  if (isPractice) {
    coins += result === "WIN" ? COIN_REWARDS.PRACTICE_WIN : COIN_REWARDS.PRACTICE_LOSS;
  } else {
    coins += result === "WIN" ? COIN_REWARDS.VICTORY : COIN_REWARDS.LOSS;
  }

  coins += kills * COIN_REWARDS.KILL;
  return coins;
}

/**
 * Get rank name from rating.
 */
export function getRankFromRating(rating: number): string {
  if (rating < 1100) return "Bronze I";
  if (rating < 1200) return "Bronze II";
  if (rating < 1300) return "Bronze III";
  if (rating < 1450) return "Silver I";
  if (rating < 1600) return "Silver II";
  if (rating < 1750) return "Silver III";
  if (rating < 1900) return "Gold I";
  if (rating < 2100) return "Gold II";
  if (rating < 2300) return "Gold III";
  if (rating < 2500) return "Platinum I";
  if (rating < 2700) return "Platinum II";
  if (rating < 2900) return "Platinum III";
  if (rating < 3200) return "Diamond I";
  if (rating < 3500) return "Diamond II";
  return "Diamond III";
}

/**
 * Get rank tier from rating (for styling).
 */
export function getRankTier(rating: number): "bronze" | "silver" | "gold" | "platinum" | "diamond" {
  if (rating < 1300) return "bronze";
  if (rating < 1750) return "silver";
  if (rating < 2300) return "gold";
  if (rating < 2900) return "platinum";
  return "diamond";
}

/**
 * Format large numbers for display (1200 → 1.2K).
 */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Format duration in seconds to MM:SS.
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Calculate win rate percentage.
 */
export function calcWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((wins / total) * 100);
}

/**
 * Calculate KD ratio.
 */
export function calcKDRatio(kills: number, deaths: number): number {
  if (deaths === 0) return kills;
  return Math.round((kills / deaths) * 100) / 100;
}

/**
 * Generate a room code like AX-7K4P.
 */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "AX-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Simple rate limiter store (in-memory, not for production clusters).
 * For production, use Redis.
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}
