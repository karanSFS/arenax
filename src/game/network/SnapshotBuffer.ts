/**
 * SnapshotBuffer.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 * Snapshot Buffering & Hermite/Linear Interpolation for Remote Players
 *
 * Prevents remote player stuttering, teleporting, and jitter:
 * - Drops out-of-order snapshots using server tick/sequence numbers
 * - Buffers snapshots and renders remote players smoothly interpolated at (now - delay)
 * - Uses dead reckoning when network packets are delayed (never teleports or deletes)
 * - Smoothly interpolates facing angles across the ±π boundary
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface RemoteEntitySnapshot {
  tick: number;
  time: number; // milliseconds
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  shield: boolean;
  animState: string;
}

export interface InterpolatedState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  shield: boolean;
  animState: string;
}

/**
 * Shortest-arc angle interpolation (handles wrap-around between -PI and +PI)
 */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export class SnapshotBuffer {
  private buffer: RemoteEntitySnapshot[] = [];
  private lastReceivedTick = -1;
  private maxBufferSize = 30; // ~1.5 seconds of snapshots at 20 Hz

  /**
   * Push a new snapshot received from the server.
   * Drops out-of-order packets.
   */
  public push(snapshot: RemoteEntitySnapshot): void {
    // Drop out-of-order snapshots
    if (snapshot.tick <= this.lastReceivedTick) {
      return;
    }
    this.lastReceivedTick = snapshot.tick;

    this.buffer.push(snapshot);

    // Keep buffer bounded
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Get the interpolated state at a target rendering timestamp.
   * @param renderTime Client render time (typically Date.now() - interpolationDelay)
   */
  public getInterpolatedState(renderTime: number): InterpolatedState | null {
    if (this.buffer.length === 0) return null;

    // Only 1 snapshot: return it directly
    if (this.buffer.length === 1) {
      const s = this.buffer[0];
      return {
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        facing: s.facing,
        health: s.health,
        maxHealth: s.maxHealth,
        isAlive: s.isAlive,
        shield: s.shield,
        animState: s.animState,
      };
    }

    const oldest = this.buffer[0];
    const newest = this.buffer[this.buffer.length - 1];

    // Case 1: Render time is older than our oldest snapshot
    if (renderTime <= oldest.time) {
      return {
        x: oldest.x,
        y: oldest.y,
        vx: oldest.vx,
        vy: oldest.vy,
        facing: oldest.facing,
        health: oldest.health,
        maxHealth: oldest.maxHealth,
        isAlive: oldest.isAlive,
        shield: oldest.shield,
        animState: oldest.animState,
      };
    }

    // Case 2: Render time is newer than our newest snapshot (network jitter/packet delay)
    // Use DEAD RECKONING extrapolation from newest snapshot (up to 250ms)
    if (renderTime >= newest.time) {
      const dt = Math.min(0.25, (renderTime - newest.time) / 1000);
      return {
        x: newest.x + newest.vx * dt,
        y: newest.y + newest.vy * dt,
        vx: newest.vx,
        vy: newest.vy,
        facing: newest.facing,
        health: newest.health,
        maxHealth: newest.maxHealth,
        isAlive: newest.isAlive,
        shield: newest.shield,
        animState: newest.animState,
      };
    }

    // Case 3: Normal interpolation between two bounding snapshots
    for (let i = 0; i < this.buffer.length - 1; i++) {
      const s0 = this.buffer[i];
      const s1 = this.buffer[i + 1];

      if (renderTime >= s0.time && renderTime <= s1.time) {
        const timeDiff = s1.time - s0.time;
        const alpha = timeDiff > 0 ? (renderTime - s0.time) / timeDiff : 0;
        const clampedAlpha = Math.max(0, Math.min(1, alpha));

        return {
          x: s0.x + (s1.x - s0.x) * clampedAlpha,
          y: s0.y + (s1.y - s0.y) * clampedAlpha,
          vx: s0.vx + (s1.vx - s0.vx) * clampedAlpha,
          vy: s0.vy + (s1.vy - s0.vy) * clampedAlpha,
          facing: lerpAngle(s0.facing, s1.facing, clampedAlpha),
          health: s1.health,
          maxHealth: s1.maxHealth,
          isAlive: s1.isAlive,
          shield: s1.shield,
          animState: s1.animState,
        };
      }
    }

    // Fallback to newest
    return {
      x: newest.x,
      y: newest.y,
      vx: newest.vx,
      vy: newest.vy,
      facing: newest.facing,
      health: newest.health,
      maxHealth: newest.maxHealth,
      isAlive: newest.isAlive,
      shield: newest.shield,
      animState: newest.animState,
    };
  }

  public clear(): void {
    this.buffer = [];
    this.lastReceivedTick = -1;
  }
}
