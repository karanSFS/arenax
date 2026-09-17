import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateServerRoom,
  ClientInputPacket,
} from "@/game/server/ServerGameRoom";

export const dynamic = "force-dynamic";

/**
 * POST /api/rooms/[roomCode]/sync
 * ─────────────────────────────────────────────────────────────────────────────
 * Authoritative Server Synchronization Endpoint for ArenaX Multiplayer
 *
 * Receives:
 * - Client input stream (up, down, left, right, worldAim, facing, actions, seq)
 *
 * Runs:
 * - Deterministic fixed-step authoritative simulation (swept collisions, HP, kills)
 *
 * Returns:
 * - Server tick and timestamp
 * - lastProcessedInputSeq (for client prediction reconciliation)
 * - Authoritative localPlayer state (position, HP, kills, score)
 * - Remote players array (with serverTick for snapshot buffering & interpolation)
 * - Authoritative projectiles & events (damage, kills, respawns)
 * - Disconnected player list
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const roomCode = params.roomCode.toUpperCase();
    const body = await req.json();

    const userId =
      body.playerId ||
      body.userId ||
      body.state?.userId ||
      "anon-" + Math.random().toString(36).slice(2, 8);

    const username = body.username || body.state?.username || "Player";
    const characterSlug =
      body.characterSlug || body.state?.characterSlug || "blaze";
    const arenaId = body.arenaId || "cyber_grid";
    const lastKnownTick =
      typeof body.lastKnownTick === "number" ? body.lastKnownTick : 0;

    // 1. Get or create the authoritative room instance
    const room = getOrCreateServerRoom(roomCode, arenaId);

    // 2. Register/update player heartbeat
    room.addOrUpdatePlayer(userId, username, characterSlug);

    // 3. Ingest client inputs queue (client prediction + server reconciliation)
    const inputs: ClientInputPacket[] = Array.isArray(body.inputs)
      ? body.inputs
      : [];

    // Backward compatibility: single input packet or action
    if (inputs.length === 0 && (body.input || body.action)) {
      inputs.push({
        seq: typeof body.seq === "number" ? body.seq : 1,
        up: !!body.input?.up,
        down: !!body.input?.down,
        left: !!body.input?.left,
        right: !!body.input?.right,
        worldAimX: typeof body.input?.worldAimX === "number" ? body.input.worldAimX : 0,
        worldAimY: typeof body.input?.worldAimY === "number" ? body.input.worldAimY : 0,
        facing: typeof body.input?.facing === "number" ? body.input.facing : 0,
        isMouseAiming: !!body.input?.isMouseAiming,
        action: body.action,
      });
    }

    if (inputs.length > 0) {
      room.enqueueInputs(userId, inputs);
    }

    // 4. Advance deterministic simulation up to current timestamp
    room.stepSimulation(Date.now());

    // 5. Generate authoritative snapshot for this player
    const snapshot = room.getSnapshotForPlayer(userId, lastKnownTick);

    return NextResponse.json({
      ...snapshot,
      // Retain data namespace for backward compatibility
      data: {
        ...snapshot,
      },
    });
  } catch (err) {
    console.error("Authoritative room sync error:", err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "SYNC_ERROR", message: "Authoritative sync failed." },
      },
      { status: 500 }
    );
  }
}
