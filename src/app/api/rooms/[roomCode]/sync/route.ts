import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ─── In-Memory Game State Store ──────────────────────────────────────────────
// NO MongoDB in the game loop. MongoDB is only for match result persistence.
// All real-time game state lives in this process-global in-memory store.
// Sub-millisecond response times vs 300-800ms MongoDB round trips.
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerSyncState {
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
  action?: { type: string; x?: number; y?: number; timestamp?: number };
  updatedAt: number;
}

interface StoredProjectile {
  id: string;
  senderId: string;
  projectile: any;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var _arenaxMemPlayers: Map<string, Map<string, PlayerSyncState>> | undefined;
  // eslint-disable-next-line no-var
  var _arenaxMemProjectiles: Map<string, StoredProjectile[]> | undefined;
}

if (!global._arenaxMemPlayers) {
  global._arenaxMemPlayers = new Map();
}
if (!global._arenaxMemProjectiles) {
  global._arenaxMemProjectiles = new Map();
}

// TTL constants
const PLAYER_STALE_MS = 15_000; // Remove player after 15s of inactivity
const PROJ_STALE_MS   =  2_000; // Remove projectiles after 2s
const MAX_PROJ_QUEUE  =    200; // Max projectiles per room to prevent memory growth

function getRoomPlayers(roomCode: string): Map<string, PlayerSyncState> {
  const store = global._arenaxMemPlayers!;
  if (!store.has(roomCode)) store.set(roomCode, new Map());
  return store.get(roomCode)!;
}

function getRoomProjectiles(roomCode: string): StoredProjectile[] {
  const store = global._arenaxMemProjectiles!;
  if (!store.has(roomCode)) store.set(roomCode, []);
  return store.get(roomCode)!;
}

// ─── POST /api/rooms/[roomCode]/sync ─────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { roomCode: string } }
) {
  try {
    const roomCode = params.roomCode.toUpperCase();
    const body = await req.json();

    const pData = body.state || body;
    const callerId =
      body.playerId ||
      pData.userId ||
      "anon-" + Math.random().toString(36).slice(2, 8);

    const now = Date.now();

    // ── 1. Upsert caller state into in-memory room map ───────────────────────
    const roomPlayers = getRoomPlayers(roomCode);
    const playerState: PlayerSyncState = {
      userId:        callerId,
      username:      pData.username || "Player",
      characterSlug: pData.characterSlug || "blaze",
      x:             typeof pData.x        === "number"  ? pData.x        : 1200,
      y:             typeof pData.y        === "number"  ? pData.y        : 700,
      vx:            typeof pData.vx       === "number"  ? pData.vx       : 0,
      vy:            typeof pData.vy       === "number"  ? pData.vy       : 0,
      facing:        typeof pData.facing   === "number"  ? pData.facing   : 0,
      health:        typeof pData.health   === "number"  ? pData.health   : 100,
      maxHealth:     typeof pData.maxHealth === "number" ? pData.maxHealth : 100,
      score:         typeof pData.score    === "number"  ? pData.score    : 0,
      kills:         typeof pData.kills    === "number"  ? pData.kills    : 0,
      deaths:        typeof pData.deaths   === "number"  ? pData.deaths   : 0,
      isAlive:       typeof pData.isAlive  === "boolean" ? pData.isAlive  : true,
      action:        pData.action || body.action,
      updatedAt:     now,
    };
    roomPlayers.set(callerId, playerState);

    // ── 2. Add incoming projectiles from this caller ─────────────────────────
    const newProjectiles: any[] = Array.isArray(body.projectiles) ? body.projectiles : [];
    const roomProjs = getRoomProjectiles(roomCode);

    for (const p of newProjectiles) {
      if (p && typeof p.x === "number" && typeof p.vx === "number") {
        roomProjs.push({
          id: p.id || `p_${callerId}_${now}_${Math.random().toString(36).slice(2, 6)}`,
          senderId: callerId,
          projectile: p,
          createdAt: now,
        });
      }
    }

    // ── 3. Evict stale projectiles and trim queue ────────────────────────────
    const freshProjs = roomProjs.filter((p) => now - p.createdAt < PROJ_STALE_MS);
    const trimmedProjs = freshProjs.length > MAX_PROJ_QUEUE
      ? freshProjs.slice(freshProjs.length - MAX_PROJ_QUEUE)
      : freshProjs;
    global._arenaxMemProjectiles!.set(roomCode, trimmedProjs);

    // ── 4. Evict stale players — track who timed out ─────────────────────────
    // Players are ONLY removed after 15s without a heartbeat.
    // Clients must receive this list and explicitly remove those entities.
    const disconnectedPlayers: string[] = [];
    for (const [pid, p] of roomPlayers.entries()) {
      if (now - p.updatedAt > PLAYER_STALE_MS) {
        disconnectedPlayers.push(pid);
        roomPlayers.delete(pid);
      }
    }

    // ── 5. Build response: other players + their queued projectiles ──────────
    const otherPlayers: PlayerSyncState[] = [];
    for (const [pid, p] of roomPlayers.entries()) {
      if (pid !== callerId) {
        otherPlayers.push(p);
      }
    }

    // Projectiles fired by other players (the client deduplicates by ID)
    const incomingProjectiles = trimmedProjs
      .filter((p) => p.senderId !== callerId)
      .map((p) => ({
        ...p.projectile,
        id: p.id,
        ownerId: p.senderId,
      }));

    return NextResponse.json({
      success: true,
      players: otherPlayers,
      incomingProjectiles,
      disconnectedPlayers,
      incomingDamage: [], // Damage is now determined by health field in state sync
      data: {
        timestamp: now,
        players: otherPlayers,
        incomingProjectiles,
        disconnectedPlayers,
        incomingDamage: [],
      },
    });
  } catch (err) {
    console.error("Room sync error:", err);
    return NextResponse.json(
      { success: false, error: { code: "SYNC_ERROR", message: "Sync failed." } },
      { status: 500 }
    );
  }
}
