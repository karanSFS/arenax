import mongoose, { Schema, Document, Model } from "mongoose";

// ─── Inventory ────────────────────────────────────────────────────────────────
const InventoryItemSchema = new Schema({
  itemId: { type: String, required: true },
  itemType: {
    type: String,
    enum: ["character", "skin", "emote", "banner", "effect"],
    required: true,
  },
  quantity: { type: Number, default: 1 },
  unlockedAt: { type: Date, default: Date.now },
});

export interface InventoryDocument extends Document {
  userId: string;
  items: Array<{
    itemId: string;
    itemType: string;
    quantity: number;
    unlockedAt: Date;
  }>;
}

const InventorySchema = new Schema<InventoryDocument>(
  {
    userId: { type: String, required: true },
    items: [InventoryItemSchema],
  },
  { collection: "inventories" }
);

InventorySchema.index({ userId: 1 }, { unique: true });

export const Inventory: Model<InventoryDocument> =
  mongoose.models.Inventory ||
  mongoose.model<InventoryDocument>("Inventory", InventorySchema);

// ─── XP Transactions ──────────────────────────────────────────────────────────
export interface XPTransactionDocument extends Document {
  userId: string;
  amount: number;
  reason: string;
  matchId?: string;
  createdAt: Date;
}

const XPTransactionSchema = new Schema<XPTransactionDocument>(
  {
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    matchId: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "xpTransactions",
  }
);

XPTransactionSchema.index({ userId: 1 });
XPTransactionSchema.index({ matchId: 1 });
XPTransactionSchema.index({ createdAt: -1 });

export const XPTransaction: Model<XPTransactionDocument> =
  mongoose.models.XPTransaction ||
  mongoose.model<XPTransactionDocument>("XPTransaction", XPTransactionSchema);

// ─── Coin Transactions ────────────────────────────────────────────────────────
export interface CoinTransactionDocument extends Document {
  userId: string;
  amount: number;
  type: "EARN" | "SPEND" | "REWARD" | "REFUND";
  reason: string;
  matchId?: string;
  createdAt: Date;
}

const CoinTransactionSchema = new Schema<CoinTransactionDocument>(
  {
    userId: { type: String, required: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ["EARN", "SPEND", "REWARD", "REFUND"],
      required: true,
    },
    reason: { type: String, required: true },
    matchId: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "coinTransactions",
  }
);

CoinTransactionSchema.index({ userId: 1 });
CoinTransactionSchema.index({ matchId: 1 });
CoinTransactionSchema.index({ createdAt: -1 });

export const CoinTransaction: Model<CoinTransactionDocument> =
  mongoose.models.CoinTransaction ||
  mongoose.model<CoinTransactionDocument>(
    "CoinTransaction",
    CoinTransactionSchema
  );

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export interface LeaderboardDocument extends Document {
  userId: string;
  rating: number;
  wins: number;
  kills: number;
  level: number;
  weeklyRating: number;
  updatedAt: Date;
}

const LeaderboardSchema = new Schema<LeaderboardDocument>(
  {
    userId: { type: String, required: true },
    rating: { type: Number, default: 1000 },
    wins: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    weeklyRating: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: "leaderboards",
  }
);

LeaderboardSchema.index({ userId: 1 }, { unique: true });
LeaderboardSchema.index({ rating: -1 });
LeaderboardSchema.index({ weeklyRating: -1 });
LeaderboardSchema.index({ wins: -1 });
LeaderboardSchema.index({ kills: -1 });

export const Leaderboard: Model<LeaderboardDocument> =
  mongoose.models.Leaderboard ||
  mongoose.model<LeaderboardDocument>("Leaderboard", LeaderboardSchema);

// ─── Achievement ──────────────────────────────────────────────────────────────
export interface AchievementDocument extends Document {
  name: string;
  slug: string;
  description: string;
  icon: string;
  requirement: { type: string; value: number };
  xpReward: number;
  coinReward: number;
  createdAt: Date;
}

const AchievementSchema = new Schema<AchievementDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    requirement: {
      type: { type: String, required: true },
      value: { type: Number, required: true },
    },
    xpReward: { type: Number, default: 0 },
    coinReward: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "achievements",
  }
);

AchievementSchema.index({ slug: 1 }, { unique: true });

export const Achievement: Model<AchievementDocument> =
  mongoose.models.Achievement ||
  mongoose.model<AchievementDocument>("Achievement", AchievementSchema);

// ─── Player Achievement ───────────────────────────────────────────────────────
export interface PlayerAchievementDocument extends Document {
  userId: string;
  achievementId: mongoose.Types.ObjectId;
  unlockedAt: Date;
}

const PlayerAchievementSchema = new Schema<PlayerAchievementDocument>(
  {
    userId: { type: String, required: true },
    achievementId: { type: Schema.Types.ObjectId, ref: "Achievement", required: true },
    unlockedAt: { type: Date, default: Date.now },
  },
  { collection: "playerAchievements" }
);

// Compound unique index prevents duplicate achievement unlocks
PlayerAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
PlayerAchievementSchema.index({ userId: 1 });

export const PlayerAchievement: Model<PlayerAchievementDocument> =
  mongoose.models.PlayerAchievement ||
  mongoose.model<PlayerAchievementDocument>(
    "PlayerAchievement",
    PlayerAchievementSchema
  );

// ─── Player Settings ──────────────────────────────────────────────────────────
export interface PlayerSettingsDocument extends Document {
  userId: string;
  audio: { master: number; music: number; sfx: number };
  graphics: { quality: string; particles: boolean; screenShake: boolean };
  controls: { layout: string };
  gameplay: { vibration: boolean; screenShake: boolean; showDamageNumbers: boolean };
  updatedAt: Date;
}

const PlayerSettingsSchema = new Schema<PlayerSettingsDocument>(
  {
    userId: { type: String, required: true },
    audio: {
      master: { type: Number, default: 80 },
      music: { type: Number, default: 60 },
      sfx: { type: Number, default: 80 },
    },
    graphics: {
      quality: { type: String, enum: ["low", "medium", "high"], default: "high" },
      particles: { type: Boolean, default: true },
      screenShake: { type: Boolean, default: true },
    },
    controls: {
      layout: { type: String, enum: ["default", "alternative"], default: "default" },
    },
    gameplay: {
      vibration: { type: Boolean, default: true },
      screenShake: { type: Boolean, default: true },
      showDamageNumbers: { type: Boolean, default: true },
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: "playerSettings",
  }
);

PlayerSettingsSchema.index({ userId: 1 }, { unique: true });

export const PlayerSettings: Model<PlayerSettingsDocument> =
  mongoose.models.PlayerSettings ||
  mongoose.model<PlayerSettingsDocument>("PlayerSettings", PlayerSettingsSchema);
