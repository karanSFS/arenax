import mongoose, { Schema, Document, Model } from "mongoose";

export interface MatchPlayerDocument extends Document {
  matchId: mongoose.Types.ObjectId;
  userId: string;
  characterId: string;
  kills: number;
  deaths: number;
  damage: number;
  score: number;
  xpEarned: number;
  coinsEarned: number;
  result: "WIN" | "LOSS" | "DRAW";
  createdAt: Date;
}

const MatchPlayerSchema = new Schema<MatchPlayerDocument>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    userId: { type: String, required: true },
    characterId: { type: String, required: true },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    damage: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    coinsEarned: { type: Number, default: 0 },
    result: { type: String, enum: ["WIN", "LOSS", "DRAW"], required: true },
  },
  {
    timestamps: true,
    collection: "matchPlayers",
  }
);

MatchPlayerSchema.index({ matchId: 1 });
MatchPlayerSchema.index({ userId: 1 });
MatchPlayerSchema.index({ userId: 1, matchId: 1 });

const MatchPlayer: Model<MatchPlayerDocument> =
  mongoose.models.MatchPlayer ||
  mongoose.model<MatchPlayerDocument>("MatchPlayer", MatchPlayerSchema);

export default MatchPlayer;
