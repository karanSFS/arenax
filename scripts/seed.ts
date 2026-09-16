#!/usr/bin/env tsx
/**
 * ARENAX Database Seed Script
 * Run: npm run db:seed
 *
 * Creates characters and achievements without duplicates.
 * Safe to run multiple times.
 */

import mongoose from "mongoose";
import { CHARACTER_DATA, ACHIEVEMENT_DATA } from "../src/game/characters/CharacterConfig";

// Load env
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

const MONGODB_URI = process.env.MONGODB_URI as string;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "arenax";

async function seed() {
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI not set in .env.local");
    process.exit(1);
  }

  console.log("🔗 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
  console.log("✅ Connected to:", MONGODB_DB_NAME);

  // ─── Seed Characters ──────────────────────────────────
  const CharacterModel = mongoose.model(
    "Character",
    new mongoose.Schema({
      name: String,
      slug: String,
      description: String,
      role: String,
      stats: Object,
      abilities: Object,
      color: String,
      accentColor: String,
      isActive: Boolean,
    }, { collection: "characters", timestamps: true })
  );

  console.log("\n🎮 Seeding characters...");
  let charCreated = 0;
  let charSkipped = 0;

  for (const char of CHARACTER_DATA) {
    const existing = await CharacterModel.findOne({ slug: char.slug });
    if (existing) {
      console.log(`  ⏭️  Character "${char.name}" already exists, skipping.`);
      charSkipped++;
    } else {
      await CharacterModel.create(char);
      console.log(`  ✅ Created character: ${char.name}`);
      charCreated++;
    }
  }

  console.log(`  📊 Characters: ${charCreated} created, ${charSkipped} skipped.`);

  // ─── Seed Achievements ────────────────────────────────
  const AchievementModel = mongoose.model(
    "Achievement",
    new mongoose.Schema({
      name: String,
      slug: String,
      description: String,
      icon: String,
      requirement: Object,
      xpReward: Number,
      coinReward: Number,
    }, { collection: "achievements", timestamps: true })
  );

  console.log("\n🏆 Seeding achievements...");
  let achCreated = 0;
  let achSkipped = 0;

  for (const ach of ACHIEVEMENT_DATA) {
    const existing = await AchievementModel.findOne({ slug: ach.slug });
    if (existing) {
      console.log(`  ⏭️  Achievement "${ach.name}" already exists, skipping.`);
      achSkipped++;
    } else {
      await AchievementModel.create(ach);
      console.log(`  ✅ Created achievement: ${ach.name}`);
      achCreated++;
    }
  }

  console.log(`  📊 Achievements: ${achCreated} created, ${achSkipped} skipped.`);

  console.log("\n✅ Seeding complete!");
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
