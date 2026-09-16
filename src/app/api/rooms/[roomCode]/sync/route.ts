import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export interface PlayerSyncPayload {
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

// In-memory local cache across requests in the same lambda
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
    const roomCode = params.roomCode.toUpperCase();
    const body = await req.json();

    // Support both direct payload or wrapped in .state
    const pData = body.state || body;
    const callerId =
      body.playerId ||
      pData.userId ||
      (session?.user as { id?: string })?.id ||
      req.headers.get("x-player-id") ||
      "anon-" + req.ip;

    const callerName =
      pData.username ||
      (session?.user as { username?: string })?.username ||
      session?.user?.name ||
      "Player";

    const callerChar = pData.characterSlug || "blaze";

    const now = Date.now();
    let incomingDamage: Array<{ damage: number; attackerId?: string }> = [];

    const playerPayload: PlayerSyncPayload = {
      userId: callerId,
      username: callerName,
      characterSlug: callerChar,
      x: typeof pData.x === "number" ? pData.x : 1200,
      y: typeof pData.y === "number" ? pData.y : 700,
      vx: typeof pData.vx === "number" ? pData.vx : 0,
      vy: typeof pData.vy === "number" ? pData.vy : 0,
      facing: typeof pData.facing === "number" ? pData.facing : 0,
      health: typeof pData.health === "number" ? pData.health : 100,
      maxHealth: typeof pData.maxHealth === "number" ? pData.maxHealth : 100,
      score: typeof pData.score === "number" ? pData.score : 0,
      kills: typeof pData.kills === "number" ? pData.kills : 0,
      deaths: typeof pData.deaths === "number" ? pData.deaths : 0,
      isAlive: typeof pData.isAlive === "boolean" ? pData.isAlive : true,
      action: pData.action || body.action,
      signal: pData.signal || body.signal,
      updatedAt: now,
    };

    // 1. Update in-memory local layer
    const memRooms = global._arenaxRoomSync!;
    if (!memRooms.has(roomCode)) {
      memRooms.set(roomCode, new Map());
    }
    const memRoom = memRooms.get(roomCode)!;
    memRoom.set(callerId, playerPayload);

    // 2. Persist to MongoDB room_states so all Vercel serverless lambdas share real-time state
    try {
      await connectDB();
      const db = mongoose.connection.db;
      if (db) {
        const col = db.collection("room_states");
        await col.updateOne(
          { _id: `${roomCode}:${callerId}` as any },
          {
            $set: {
              ...playerPayload,
              roomCode,
              updatedAtDate: new Date(),
            },
          },
          { upsert: true }
        );

        // 2b. Process damage events sent by attacker
        const damageEvents = Array.isArray(body.damageEvents) ? body.damageEvents : [];
        if (damageEvents.length > 0) {
          const dmgCol = db.collection("room_damage");
          for (const de of damageEvents) {
            if (de.targetId && typeof de.damage === "number") {
              await dmgCol.insertOne({
                roomCode,
                targetId: de.targetId,
                attackerId: callerId,
                damage: de.damage,
                createdAt: new Date(),
              });
            }
          }
        }

        // 2c. Fetch any damage inflicted upon this caller
        const dmgCol = db.collection("room_damage");
        const incomingDocs = await dmgCol
          .find({ roomCode, targetId: callerId })
          .toArray();

        if (incomingDocs.length > 0) {
          const idsToDelete = incomingDocs.map((d) => d._id);
          await dmgCol.deleteMany({ _id: { $in: idsToDelete } });
          incomingDamage = incomingDocs.map((d) => ({
            damage: d.damage,
            attackerId: d.attackerId,
          }));
        }

        // Fetch all active players in this room updated within last 5 seconds
        const activeSince = new Date(Date.now() - 5000);
        const dbDocs = await col
          .find({ roomCode, updatedAtDate: { $gt: activeSince } })
          .toArray();

        // Merge DB players into memory layer
        for (const doc of dbDocs) {
          if (doc.userId) {
            memRoom.set(doc.userId, {
              userId: doc.userId,
              username: doc.username,
              characterSlug: doc.characterSlug,
              x: doc.x,
              y: doc.y,
              vx: doc.vx,
              vy: doc.vy,
              facing: doc.facing,
              health: doc.health,
              maxHealth: doc.maxHealth,
              score: doc.score,
              kills: doc.kills,
              deaths: doc.deaths,
              isAlive: doc.isAlive,
              action: doc.action,
              signal: doc.signal,
              updatedAt: doc.updatedAt || Date.now(),
            });
          }
        }
      }
    } catch (dbErr) {
      console.warn("MongoDB room_sync fallback to in-memory:", dbErr);
    }

    // Clean up stale memory records (> 6 seconds)
    for (const [pId, p] of memRoom.entries()) {
      if (now - p.updatedAt > 6000) {
        memRoom.delete(pId);
      }
    }

    // Extract all other players in this room
    const otherPlayers: PlayerSyncPayload[] = [];
    for (const [pId, p] of memRoom.entries()) {
      if (pId !== callerId) {
        otherPlayers.push(p);
      }
    }

    // Provide both top-level `players` and `data.players` for absolute compatibility
    return NextResponse.json({
      success: true,
      players: otherPlayers,
      incomingDamage,
      data: {
        timestamp: now,
        players: otherPlayers,
        incomingDamage,
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
