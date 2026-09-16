import mongoose, { Schema, Document, Model } from "mongoose";

export interface MatchDocument extends Document {
  roomId: mongoose.Types.ObjectId;
  gameMode: string;
  arena: string;
  players: string[];
  winnerId?: string;
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  startedAt?: Date;
  endedAt?: Date;
  duration?: number;
  processed: boolean;
  createdAt: Date;
}

const MatchSchema = new Schema<MatchDocument>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    gameMode: { type: String, required: true },
    arena: { type: String, required: true },
    players: [{ type: String }],
    winnerId: { type: String },
    status: {
      type: String,
      enum: ["WAITING", "IN_PROGRESS", "FINISHED", "CANCELLED"],
      default: "WAITING",
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
    duration: { type: Number },
    // Idempotency flag: prevents double-processing
    processed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "matches",
  }
);

MatchSchema.index({ roomId: 1 });
MatchSchema.index({ winnerId: 1 });
MatchSchema.index({ createdAt: -1 });
MatchSchema.index({ status: 1 });
MatchSchema.index({ players: 1 });

const Match: Model<MatchDocument> =
  mongoose.models.Match || mongoose.model<MatchDocument>("Match", MatchSchema);

export default Match;
