#!/usr/bin/env tsx
/**
 * ARENAX Index Creation Script
 * Run: npm run db:indexes
 */

import mongoose from "mongoose";
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

const MONGODB_URI = process.env.MONGODB_URI as string;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "arenax";

async function createIndexes() {
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI not set");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
  console.log("✅ Connected. Creating indexes...\n");

  const db = mongoose.connection.db!;

  const indexOps = [
    // Users
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ username: 1 }, { unique: true }),
    // Profiles
    db.collection("profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("profiles").createIndex({ rating: -1 }),
    // Characters
    db.collection("characters").createIndex({ slug: 1 }, { unique: true }),
    // Rooms
    db.collection("rooms").createIndex({ roomCode: 1 }, { unique: true }),
    db.collection("rooms").createIndex({ status: 1 }),
    db.collection("rooms").createIndex({ hostUserId: 1 }),
    // Matches
    db.collection("matches").createIndex({ roomId: 1 }),
    db.collection("matches").createIndex({ winnerId: 1 }),
    db.collection("matches").createIndex({ createdAt: -1 }),
    db.collection("matches").createIndex({ status: 1 }),
    // Match Players
    db.collection("matchPlayers").createIndex({ matchId: 1 }),
    db.collection("matchPlayers").createIndex({ userId: 1 }),
    // Player Stats
    db.collection("playerStats").createIndex({ userId: 1 }, { unique: true }),
    db.collection("playerStats").createIndex({ rating: -1 }),
    // Leaderboards
    db.collection("leaderboards").createIndex({ userId: 1 }, { unique: true }),
    db.collection("leaderboards").createIndex({ rating: -1 }),
    db.collection("leaderboards").createIndex({ weeklyRating: -1 }),
    db.collection("leaderboards").createIndex({ wins: -1 }),
    db.collection("leaderboards").createIndex({ kills: -1 }),
    // Achievements
    db.collection("achievements").createIndex({ slug: 1 }, { unique: true }),
    // Player Achievements (compound unique)
    db.collection("playerAchievements").createIndex({ userId: 1, achievementId: 1 }, { unique: true }),
    // XP Transactions
    db.collection("xpTransactions").createIndex({ userId: 1 }),
    db.collection("xpTransactions").createIndex({ createdAt: -1 }),
    // Coin Transactions
    db.collection("coinTransactions").createIndex({ userId: 1 }),
    db.collection("coinTransactions").createIndex({ createdAt: -1 }),
    // Inventories
    db.collection("inventories").createIndex({ userId: 1 }, { unique: true }),
    // Player Settings
    db.collection("playerSettings").createIndex({ userId: 1 }, { unique: true }),
  ];

  await Promise.allSettled(indexOps);
  console.log("✅ All indexes created successfully.");

  await mongoose.disconnect();
  process.exit(0);
}

createIndexes().catch((err) => {
  console.error("❌ Index creation error:", err);
  process.exit(1);
});
