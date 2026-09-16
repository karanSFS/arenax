// ═══════════════════════════════════════════
// ARENA MAP CONFIGURATIONS
// All visual and collision data for each arena
// ═══════════════════════════════════════════

export interface ArenaWall {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArenaConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  gridColor: string;
  accentColor: string;
  walls: ArenaWall[];
  spawnPoints: Array<{ x: number; y: number }>;
  ambientParticleColor: string;
}

const W = 1920;
const H = 1080;

export const ARENAS: Record<string, ArenaConfig> = {
  cyber_grid: {
    id: "cyber_grid",
    name: "Cyber Grid",
    width: W,
    height: H,
    backgroundColor: "#020510",
    gridColor: "rgba(0,245,255,0.08)",
    accentColor: "#00f5ff",
    ambientParticleColor: "#00f5ff",
    walls: [
      // Outer boundary (thick)
      { x: 0, y: 0, width: W, height: 30 },
      { x: 0, y: H - 30, width: W, height: 30 },
      { x: 0, y: 0, width: 30, height: H },
      { x: W - 30, y: 0, width: 30, height: H },
      // Center pillars
      { x: W / 2 - 60, y: H / 2 - 80, width: 120, height: 160 },
      // Side platforms
      { x: 200, y: 300, width: 200, height: 30 },
      { x: 200, y: 700, width: 200, height: 30 },
      { x: W - 400, y: 300, width: 200, height: 30 },
      { x: W - 400, y: 700, width: 200, height: 30 },
      // Quarter walls
      { x: W / 2 - 180, y: 150, width: 30, height: 150 },
      { x: W / 2 + 150, y: 150, width: 30, height: 150 },
      { x: W / 2 - 180, y: H - 300, width: 30, height: 150 },
      { x: W / 2 + 150, y: H - 300, width: 30, height: 150 },
    ],
    spawnPoints: [
      { x: 150, y: H / 2 },
      { x: W - 150, y: H / 2 },
      { x: W / 2, y: 150 },
      { x: W / 2, y: H - 150 },
    ],
  },

  void_core: {
    id: "void_core",
    name: "Void Core",
    width: W,
    height: H,
    backgroundColor: "#050005",
    gridColor: "rgba(191,95,255,0.06)",
    accentColor: "#bf5fff",
    ambientParticleColor: "#bf5fff",
    walls: [
      // Outer boundary
      { x: 0, y: 0, width: W, height: 30 },
      { x: 0, y: H - 30, width: W, height: 30 },
      { x: 0, y: 0, width: 30, height: H },
      { x: W - 30, y: 0, width: 30, height: H },
      // Dark matter pillars
      { x: 350, y: 200, width: 80, height: 200 },
      { x: 350, y: 650, width: 80, height: 200 },
      { x: W - 430, y: 200, width: 80, height: 200 },
      { x: W - 430, y: 650, width: 80, height: 200 },
      // Center void
      { x: W / 2 - 40, y: H / 2 - 100, width: 80, height: 80 },
      { x: W / 2 - 40, y: H / 2 + 20, width: 80, height: 80 },
      // Cross walls
      { x: W / 2 - 200, y: H / 2 - 15, width: 140, height: 30 },
      { x: W / 2 + 60, y: H / 2 - 15, width: 140, height: 30 },
    ],
    spawnPoints: [
      { x: 200, y: 200 },
      { x: W - 200, y: H - 200 },
      { x: 200, y: H - 200 },
      { x: W - 200, y: 200 },
    ],
  },

  industrial_zone: {
    id: "industrial_zone",
    name: "Industrial Zone",
    width: W,
    height: H,
    backgroundColor: "#030608",
    gridColor: "rgba(57,255,20,0.05)",
    accentColor: "#39ff14",
    ambientParticleColor: "#ff6b00",
    walls: [
      // Outer boundary
      { x: 0, y: 0, width: W, height: 30 },
      { x: 0, y: H - 30, width: W, height: 30 },
      { x: 0, y: 0, width: 30, height: H },
      { x: W - 30, y: 0, width: 30, height: H },
      // Industrial crates
      { x: 200, y: 200, width: 100, height: 100 },
      { x: 200, y: H - 300, width: 100, height: 100 },
      { x: W - 300, y: 200, width: 100, height: 100 },
      { x: W - 300, y: H - 300, width: 100, height: 100 },
      // Long conveyors
      { x: 400, y: H / 2 - 15, width: 300, height: 30 },
      { x: W - 700, y: H / 2 - 15, width: 300, height: 30 },
      // Vertical covers
      { x: W / 2 - 15, y: 200, width: 30, height: 200 },
      { x: W / 2 - 15, y: H - 400, width: 30, height: 200 },
    ],
    spawnPoints: [
      { x: 120, y: 500 },
      { x: W - 120, y: 500 },
      { x: W / 2, y: 100 },
      { x: W / 2, y: H - 100 },
    ],
  },
};
