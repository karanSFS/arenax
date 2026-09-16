import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import mongoose from "mongoose";
import Match from "@/models/Match";
import MatchPlayer from "@/models/MatchPlayer";
import Profile from "@/models/Profile";
import PlayerStats from "@/models/PlayerStats";
import { Inventory, XPTransaction, CoinTransaction, Leaderboard, Achievement, PlayerAchievement } from "@/models/index";
import { CompleteMatchSchema } from "@/lib/validation/schemas";
import {
  calculateMatchXP,
  calculateMatchCoins,
  levelFromXP,
  getRankFromRating,
  RATING_CHANGES,
  calcWinRate,
  calcKDRatio,
} from "@/lib/utils/progression";

// POST /api/matches/complete
// Server-authoritative: calculates all rewards server-side.
// Idempotent: will not double-award if called twice.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = CompleteMatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }

    const { matchId, winnerId, players, duration, arena, gameMode } = parsed.data;

    await connectDB();

    // ── IDEMPOTENCY CHECK ──────────────────────────────────────────────────────
    // If already processed, return the existing result without re-awarding.
    const existingMatch = await Match.findById(matchId);
    if (!existingMatch) {
      return NextResponse.json(
        { success: false, error: { code: "MATCH_NOT_FOUND", message: "Match not found." } },
        { status: 404 }
      );
    }
    if (existingMatch.processed) {
      return NextResponse.json({
        success: true,
        data: { message: "Match already processed.", matchId },
      });
    }

    const isPractice = gameMode === "PRACTICE";

    // ── MONGODB TRANSACTION ────────────────────────────────────────────────────
    const mongoSession = await mongoose.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        // 1. Mark match as processed (atomic) + set winner
        await Match.findByIdAndUpdate(
          matchId,
          {
            $set: {
              status: "FINISHED",
              winnerId,
              endedAt: new Date(),
              duration,
              processed: true,
            },
          },
          { session: mongoSession }
        );

        // 2. For each player — calculate rewards and update everything
        for (const player of players) {
          const { userId, characterId, kills, deaths, damage, score } = player;
          const result: "WIN" | "LOSS" | "DRAW" = userId === winnerId ? "WIN" : "LOSS";

          // Server calculates XP and coins — client cannot specify these
          const xpEarned = calculateMatchXP({ result, kills, isPractice });
          const coinsEarned = calculateMatchCoins({ result, kills, isPractice });
          const ratingDelta = isPractice
            ? 0
            : result === "WIN"
            ? RATING_CHANGES.WIN
            : RATING_CHANGES.LOSS;

          // 2a. Create MatchPlayer record
          await MatchPlayer.create(
            [{ matchId, userId, characterId, kills, deaths, damage, score, xpEarned, coinsEarned, result }],
            { session: mongoSession }
          );

          // 2b. Update Profile (XP, level, coins, rating, rank)
          const profile = await Profile.findOne({ userId }).session(mongoSession);
          if (profile) {
            const newXP = profile.xp + xpEarned;
            const newLevel = levelFromXP(newXP);
            const newRating = Math.max(0, profile.rating + ratingDelta);
            const newRank = getRankFromRating(newRating);

            await Profile.findOneAndUpdate(
              { userId },
              {
                $set: {
                  xp: newXP,
                  level: newLevel,
                  rating: newRating,
                  rank: newRank,
                },
                $inc: { coins: coinsEarned },
              },
              { session: mongoSession }
            );
          }

          // 2c. Update PlayerStats
          const currentStats = await PlayerStats.findOne({ userId }).session(mongoSession);
          if (currentStats) {
            const newMatchesPlayed = currentStats.matchesPlayed + 1;
            const newWins = currentStats.wins + (result === "WIN" ? 1 : 0);
            const newLosses = currentStats.losses + (result === "LOSS" ? 1 : 0);
            const newKills = currentStats.kills + kills;
            const newDeaths = currentStats.deaths + deaths;

            await PlayerStats.findOneAndUpdate(
              { userId },
              {
                $set: {
                  matchesPlayed: newMatchesPlayed,
                  wins: newWins,
                  losses: newLosses,
                  kills: newKills,
                  deaths: newDeaths,
                  damageDealt: currentStats.damageDealt + damage,
                  winRate: calcWinRate(newWins, newMatchesPlayed),
                  kdRatio: calcKDRatio(newKills, newDeaths),
                  rating: Math.max(0, currentStats.rating + ratingDelta),
                },
              },
              { session: mongoSession }
            );
          } else {
            // Create stats if doesn't exist
            await PlayerStats.create(
              [{ userId, matchesPlayed: 1, wins: result === "WIN" ? 1 : 0, losses: result === "LOSS" ? 1 : 0, kills, deaths, damageDealt: damage, winRate: result === "WIN" ? 100 : 0, kdRatio: calcKDRatio(kills, deaths) }],
              { session: mongoSession }
            );
          }

          // 2d. XP Transaction
          await XPTransaction.create(
            [{ userId, amount: xpEarned, reason: `Match ${result}`, matchId }],
            { session: mongoSession }
          );

          // 2e. Coin Transaction
          await CoinTransaction.create(
            [{ userId, amount: coinsEarned, type: "REWARD", reason: `Match ${result}`, matchId }],
            { session: mongoSession }
          );

          // 2f. Leaderboard update
          await Leaderboard.findOneAndUpdate(
            { userId },
            {
              $set: { rating: Math.max(0, (profile?.rating ?? 1000) + ratingDelta) },
              $inc: {
                wins: result === "WIN" ? 1 : 0,
                kills,
                weeklyRating: ratingDelta > 0 ? ratingDelta : 0,
              },
            },
            { session: mongoSession, upsert: true }
          );
        }
      });

      // 3. Check achievements (outside transaction — non-critical)
      for (const player of players) {
        await checkAndUnlockAchievements(player.userId).catch(console.error);
      }

      return NextResponse.json({
        success: true,
        data: {
          matchId,
          winnerId,
          processed: true,
        },
      });
    } finally {
      await mongoSession.endSession();
    }
  } catch (err) {
    console.error("Match complete error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to process match." } },
      { status: 500 }
    );
  }
}

async function checkAndUnlockAchievements(userId: string) {
  const [stats, profile, achievements] = await Promise.all([
    PlayerStats.findOne({ userId }),
    Profile.findOne({ userId }),
    Achievement.find({}),
  ]);

  if (!stats || !profile) return;

  for (const ach of achievements) {
    // Check if already unlocked
    const already = await PlayerAchievement.exists({ userId, achievementId: ach._id });
    if (already) continue;

    let unlocked = false;
    const { type, value } = ach.requirement;

    if (type === "wins" && stats.wins >= value) unlocked = true;
    else if (type === "kills" && stats.kills >= value) unlocked = true;
    else if (type === "matches" && stats.matchesPlayed >= value) unlocked = true;
    else if (type === "level" && profile.level >= value) unlocked = true;
    else if (type === "rating" && profile.rating >= value) unlocked = true;

    if (unlocked) {
      try {
        await PlayerAchievement.create({ userId, achievementId: ach._id, unlockedAt: new Date() });
        // Award achievement bonus
        if (ach.xpReward > 0 || ach.coinReward > 0) {
          await Promise.all([
            Profile.findOneAndUpdate(
              { userId },
              { $inc: { xp: ach.xpReward, coins: ach.coinReward } }
            ),
            ach.xpReward > 0 &&
              XPTransaction.create({ userId, amount: ach.xpReward, reason: `Achievement: ${ach.name}` }),
            ach.coinReward > 0 &&
              CoinTransaction.create({ userId, amount: ach.coinReward, type: "REWARD", reason: `Achievement: ${ach.name}` }),
          ]);
        }
      } catch {
        // Ignore duplicate key (already unlocked concurrently)
      }
    }
  }
}
