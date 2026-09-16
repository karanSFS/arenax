import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import Room from "@/models/Room";

export async function GET(
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

    await connectDB();
    const room = await Room.findOne({ roomCode: params.roomCode.toUpperCase() }).lean();

    if (!room) {
      return NextResponse.json(
        { success: false, error: { code: "ROOM_NOT_FOUND", message: "Room not found." } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: room });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch room." } },
      { status: 500 }
    );
  }
}
