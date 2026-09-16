import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Leaderboard } from "@/models/index";
import Profile from "@/models/Profile";
import User from "@/models/User";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "global"; // global | weekly
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "20"));
    const skip = (page - 1) * limit;

    await connectDB();

    const sortField = tab === "weekly" ? "-weeklyRating" : "-rating";

    // Efficient: sort+paginate from leaderboards collection
    const entries = await Leaderboard.find({})
      .sort(sortField)
      .skip(skip)
      .limit(limit)
      .lean();

    // Enrich with username/displayName from User + Profile
    const userIds = entries.map((e) => e.userId);

    const [users, profiles] = await Promise.all([
      User.find({ _id: { $in: userIds } }, { username: 1 }).lean(),
      Profile.find({ userId: { $in: userIds } }, { userId: 1, displayName: 1, avatar: 1, level: 1 }).lean(),
    ]);

    const userMap = new Map(users.map((u) => [u._id.toString(), u.username]));
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    const enriched = entries.map((entry, idx) => {
      const uId = entry.userId.toString();
      const profile = profileMap.get(uId);
      return {
        ...entry,
        rank: skip + idx + 1,
        username: userMap.get(uId) || "Unknown",
        displayName: profile?.displayName || userMap.get(uId) || "Unknown",
        avatar: profile?.avatar || "default",
        level: profile?.level || entry.level || 1,
      };
    });

    const total = await Leaderboard.countDocuments({});

    return NextResponse.json({
      success: true,
      data: {
        entries: enriched,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    console.error("Leaderboard GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch leaderboard." } },
      { status: 500 }
    );
  }
}
