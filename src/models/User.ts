import mongoose, { Schema, Document, Model } from "mongoose";

export interface UserDocument extends Document {
  email: string;
  username: string;
  passwordHash?: string;
  role: "player" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

const UserSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [20, "Username cannot exceed 20 characters"],
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"],
    },
    passwordHash: { type: String },
    role: { type: String, enum: ["player", "admin"], default: "player" },
    lastLoginAt: { type: Date },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });

const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);

export default User;
