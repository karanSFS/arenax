import mongoose, { Schema, Document, Model } from "mongoose";

export interface RoomPlayerDoc {
  userId: string;
  username: string;
  characterId: string;
  isReady: boolean;
  isHost: boolean;
}

export interface RoomDocument extends Document {
  roomCode: string;
  hostUserId: string;
  players: RoomPlayerDoc[];
  gameMode: "QUICK_MATCH" | "PRIVATE_ROOM" | "PRACTICE";
  arena:
    | "cyber_grid"
    | "void_core"
    | "industrial_zone"
    | "outpost"
    | "catacombs"
    | "high_tower"
    | "pyramid"
    | "lunar_base";
  status: "WAITING" | "READY" | "STARTING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
  maxPlayers: number;
  matchId?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
}

const RoomPlayerSchema = new Schema<RoomPlayerDoc>({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  characterId: { type: String, default: "" },
  isReady: { type: Boolean, default: false },
  isHost: { type: Boolean, default: false },
});

const RoomSchema = new Schema<RoomDocument>(
  {
    roomCode: { type: String, required: true, uppercase: true },
    hostUserId: { type: String, required: true },
    players: [RoomPlayerSchema],
    gameMode: {
      type: String,
      enum: ["QUICK_MATCH", "PRIVATE_ROOM", "PRACTICE"],
      required: true,
    },
    arena: {
      type: String,
      enum: [
        "cyber_grid",
        "void_core",
        "industrial_zone",
        "outpost",
        "catacombs",
        "high_tower",
        "pyramid",
        "lunar_base",
      ],
      default: "cyber_grid",
    },
    status: {
      type: String,
      enum: ["WAITING", "READY", "STARTING", "IN_PROGRESS", "FINISHED", "CANCELLED"],
      default: "WAITING",
    },
    maxPlayers: { type: Number, default: 8, min: 2, max: 20 },
    matchId: { type: String },
    startedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "rooms",
  }
);

RoomSchema.index({ roomCode: 1 }, { unique: true });
RoomSchema.index({ status: 1 });
RoomSchema.index({ hostUserId: 1 });
RoomSchema.index({ createdAt: -1 });

const Room: Model<RoomDocument> =
  mongoose.models.Room || mongoose.model<RoomDocument>("Room", RoomSchema);

export default Room;
