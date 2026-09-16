import mongoose, { Schema, Document, Model } from "mongoose";

export interface PlayerStatsDocument extends Document {
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

const PlayerStatsSchema = new Schema<PlayerStatsDocument>(
  {
    userId: { type: String, required: true },
    matchesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    damageDealt: { type: Number, default: 0 },
    damageTaken: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    kdRatio: { type: Number, default: 0 },
    rating: { type: Number, default: 1000 },
  },
  {
    timestamps: true,
    collection: "playerStats",
  }
);

PlayerStatsSchema.index({ userId: 1 }, { unique: true });
PlayerStatsSchema.index({ rating: -1 });
PlayerStatsSchema.index({ wins: -1 });

const PlayerStats: Model<PlayerStatsDocument> =
  mongoose.models.PlayerStats ||
  mongoose.model<PlayerStatsDocument>("PlayerStats", PlayerStatsSchema);

export default PlayerStats;
