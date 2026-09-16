import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Room from "@/models/Room";
import Match from "@/models/Match";
import { JoinRoomSchema } from "@/lib/validation/schemas";
import { checkRateLimit } from "@/lib/utils/progression";

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

    const { allowed } = checkRateLimit(`join-room:${userId}`, 20, 5 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMIT", message: "Too many join attempts." } },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = JoinRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }

    const { roomCode, characterId } = parsed.data;

    await connectDB();

    const room = await Room.findOne({ roomCode: roomCode.toUpperCase(), status: "WAITING" });

    if (!room) {
      return NextResponse.json(
        { success: false, error: { code: "ROOM_NOT_FOUND", message: "Room not found or no longer accepting players." } },
        { status: 404 }
      );
    }

    // Check if already in room
    const alreadyIn = room.players.some((p) => p.userId === userId);
    if (alreadyIn) {
      return NextResponse.json({ success: true, data: { room } });
    }

    // Check capacity
    if (room.players.length >= room.maxPlayers) {
      return NextResponse.json(
        { success: false, error: { code: "ROOM_FULL", message: "This room is full." } },
        { status: 409 }
      );
    }

    // Add player
    room.players.push({ userId, username, characterId, isReady: false, isHost: false });

    if (room.players.length === room.maxPlayers) {
      room.status = "READY";
    }

    await room.save();

    // Update match players list
    await Match.findOneAndUpdate(
      { roomId: room._id, status: "WAITING" },
      { $addToSet: { players: userId } }
    );

    return NextResponse.json({ success: true, data: { room } });
  } catch (err) {
    console.error("Room join error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to join room." } },
      { status: 500 }
    );
  }
}
