import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Room from "@/models/Room";
import Match from "@/models/Match";
import { CreateRoomSchema, JoinRoomSchema } from "@/lib/validation/schemas";
import { generateRoomCode, checkRateLimit } from "@/lib/utils/progression";

// POST /api/rooms/create
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } },
        { status: 401 }
      );
    }

    const userId = (session.user as { id: string }).id;
    const username = (session.user as { username?: string })?.username || session.user.name || "";

    // Rate limit: 10 room creations per 10 min
    const { allowed } = checkRateLimit(`create-room:${userId}`, 10, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMIT", message: "Too many room creations." } },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = CreateRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }

    const { gameMode, arena = "cyber_grid", maxPlayers = 2, characterId } = parsed.data;

    await connectDB();

    // Generate unique room code
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (await Room.exists({ roomCode }) && attempts < 10) {
      roomCode = generateRoomCode();
      attempts++;
    }

    const room = await Room.create({
      roomCode,
      hostUserId: userId,
      players: [{ userId, username, characterId, isReady: false, isHost: true }],
      gameMode,
      arena,
      status: "WAITING",
      maxPlayers,
    });

    // Create match record
    const match = await Match.create({
      roomId: room._id,
      gameMode,
      arena,
      players: [userId],
      status: "WAITING",
    });

    return NextResponse.json(
      { success: true, data: { room, matchId: match._id.toString() } },
      { status: 201 }
    );
  } catch (err) {
    console.error("Room create error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create room." } },
      { status: 500 }
    );
  }
}
