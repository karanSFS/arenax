import mongoose, { Schema, Document, Model } from "mongoose";

interface AbilityDoc {
  name: string;
  description: string;
  damage: number;
  cooldown: number;
  type: string;
  range: number;
}

export interface CharacterDocument extends Document {
  name: string;
  slug: string;
  description: string;
  role: "melee" | "ranged" | "tank" | "assassin";
  stats: {
    health: number;
    speed: number;
    attack: number;
    defense: number;
  };
  abilities: {
    primary: AbilityDoc;
    secondary: AbilityDoc;
    ultimate: AbilityDoc;
  };
  color: string;
  accentColor: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AbilitySchema = new Schema<AbilityDoc>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  damage: { type: Number, required: true },
  cooldown: { type: Number, required: true },
  type: { type: String, required: true },
  range: { type: Number, required: true },
});

const CharacterSchema = new Schema<CharacterDocument>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String, required: true },
    role: {
      type: String,
      enum: ["melee", "ranged", "tank", "assassin"],
      required: true,
    },
    stats: {
      health: { type: Number, required: true },
      speed: { type: Number, required: true },
      attack: { type: Number, required: true },
      defense: { type: Number, required: true },
    },
    abilities: {
      primary: { type: AbilitySchema, required: true },
      secondary: { type: AbilitySchema, required: true },
      ultimate: { type: AbilitySchema, required: true },
    },
    color: { type: String, default: "#00f5ff" },
    accentColor: { type: String, default: "#bf5fff" },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: "characters",
  }
);

CharacterSchema.index({ slug: 1 }, { unique: true });
CharacterSchema.index({ isActive: 1 });

const Character: Model<CharacterDocument> =
  mongoose.models.Character ||
  mongoose.model<CharacterDocument>("Character", CharacterSchema);

export default Character;
