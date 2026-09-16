import mongoose, { Schema, Document, Model } from "mongoose";

export interface ProfileDocument extends Document {
  userId: mongoose.Types.ObjectId;
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

const ProfileSchema = new Schema<ProfileDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    displayName: { type: String, required: true, maxlength: 30 },
    avatar: { type: String, default: "default" },
    bio: { type: String, default: "", maxlength: 200 },
    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0, min: 0 },
    coins: { type: Number, default: 500, min: 0 },
    rating: { type: Number, default: 1000, min: 0 },
    rank: { type: String, default: "Bronze I" },
  },
  {
    timestamps: true,
    collection: "profiles",
  }
);

ProfileSchema.index({ userId: 1 }, { unique: true });
ProfileSchema.index({ rating: -1 });
ProfileSchema.index({ level: -1 });

const Profile: Model<ProfileDocument> =
  mongoose.models.Profile || mongoose.model<ProfileDocument>("Profile", ProfileSchema);

export default Profile;
