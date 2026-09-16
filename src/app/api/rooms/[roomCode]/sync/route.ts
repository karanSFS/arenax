import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface PlayerSyncPayload {
  userId: string;
  username: string;
  characterSlug: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  health: number;
  maxHealth: number;
  score: number;
  kills: number;
  deaths: number;
  isAlive: boolean;
  action?: {
    type: "primary" | "secondary" | "ultimate" | "hit";
    data?: any;
  };
  signal?: any;
  updatedAt: number;
}

// In-memory global store across requests in same process
declare global {
  // eslint-disable-next-line no-var
  var _arenaxRoomSync: Map<string, Map<string, PlayerSyncPayload>> | undefined;
}

if (!global._arenaxRoomSync) {
  global._arenaxRoomSync = new Map();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const session = await auth();
    const userId =
      (session?.user as { id?: string })?.id ||
      req.headers.get("x-player-id") ||
      "anon-" + req.ip;

    const roomCode = params.roomCode.toUpperCase();
    const body = await req.json();

    const rooms = global._arenaxRoomSync!;
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, new Map());
    }

    const roomPlayers = rooms.get(roomCode)!;
    const now = Date.now();

    // Clean up stale players (> 8 seconds without update)
    for (const [pId, pData] of roomPlayers.entries()) {
      if (now - pData.updatedAt > 8000) {
        roomPlayers.delete(pId);
      }
    }

    // Save current player payload
    const playerPayload: PlayerSyncPayload = {
      userId: body.userId || userId,
      username: body.username || (session?.user?.name ?? "Player"),
      characterSlug: body.characterSlug || "blaze",
      x: body.x || 0,
      y: body.y || 0,
      vx: body.vx || 0,
      vy: body.vy || 0,
      facing: body.facing || 0,
      health: body.health !== undefined ? body.health : 100,
      maxHealth: body.maxHealth || 100,
      score: body.score || 0,
      kills: body.kills || 0,
      deaths: body.deaths || 0,
      isAlive: body.isAlive !== undefined ? body.isAlive : true,
      action: body.action,
      signal: body.signal,
      updatedAt: now,
    };

    roomPlayers.set(playerPayload.userId, playerPayload);

    // Return all other active players in room
    const otherPlayers: PlayerSyncPayload[] = [];
    for (const [pId, pData] of roomPlayers.entries()) {
      if (pId !== playerPayload.userId) {
        otherPlayers.push(pData);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        timestamp: now,
        players: otherPlayers,
      },
    });
  } catch (err) {
    console.error("Room sync error:", err);
    return NextResponse.json(
      { success: false, error: { code: "SYNC_ERROR", message: "Failed to sync room state." } },
      { status: 500 }
    );
  }
}
