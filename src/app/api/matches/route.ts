import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import MatchPlayer from "@/models/MatchPlayer";
import Match from "@/models/Match";
import Character from "@/models/Character";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } },
        { status: 401 }
      );
    }

    const userId = (session.user as { id: string }).id;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(20, parseInt(searchParams.get("limit") || "10"));
    const skip = (page - 1) * limit;

    await connectDB();

    // Get match players for this user with match details
    const matchPlayers = await MatchPlayer.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const matchIds = matchPlayers.map((mp) => mp.matchId);

    const [matches, characters] = await Promise.all([
      Match.find({ _id: { $in: matchIds } }).lean(),
      Character.find({}).lean(),
    ]);

    const matchMap = new Map(matches.map((m) => [m._id.toString(), m]));
    const charMap = new Map(characters.map((c) => [c._id.toString(), c]));

    const history = matchPlayers.map((mp) => {
      const match = matchMap.get(mp.matchId.toString());
      const char = charMap.get(mp.characterId);
      return {
        ...mp,
        match: match || null,
        character: char ? { name: char.name, role: char.role, color: char.color } : null,
      };
    });

    const total = await MatchPlayer.countDocuments({ userId });

    return NextResponse.json({
      success: true,
      data: {
        history,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    console.error("Matches GET error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch matches." } },
      { status: 500 }
    );
  }
}
