import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Room from "@/models/Room";
import Match from "@/models/Match";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated." } },
        { status: 401 }
      );
    }

    const userId = (session.user as { id: string }).id;
    const roomCode = params.roomCode.toUpperCase();

    await connectDB();

    const room = await Room.findOne({ roomCode });
    if (!room) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Room not found." } },
        { status: 404 }
      );
    }

    if (room.hostUserId !== userId) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Only the host can start the match." } },
        { status: 403 }
      );
    }

    let matchId = room.matchId;
    const playerIds = room.players.map((p) => p.userId);

    if (matchId) {
      // Update existing match with all players who joined
      await Match.findByIdAndUpdate(matchId, {
        players: playerIds,
        status: "IN_PROGRESS",
      });
    } else {
      const match = await Match.create({
        roomId: room._id,
        gameMode: room.gameMode,
        arena: room.arena,
        players: playerIds,
        status: "IN_PROGRESS",
      });
      matchId = match._id.toString();
      room.matchId = matchId;
    }

    room.status = "IN_PROGRESS";
    room.startedAt = new Date();
    await room.save();

    return NextResponse.json({
      success: true,
      data: {
        roomCode: room.roomCode,
        matchId,
        arena: room.arena,
        status: room.status,
      },
    });
  } catch (err) {
    console.error("Room start error:", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to start match." } },
      { status: 500 }
    );
  }
}
