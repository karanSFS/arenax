// ═══════════════════════════════════════════
// ARENA MAP CONFIGURATIONS
// All visual and collision data for each arena
// Inspired by iconic multiplayer arenas (e.g. Mini Militia)
// Supports up to 20 players with distributed spawn points
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
  description: string;
  width: number;
  height: number;
  backgroundColor: string;
  gridColor: string;
  accentColor: string;
  walls: ArenaWall[];
  spawnPoints: Array<{ x: number; y: number }>;
  ambientParticleColor: string;
}

const W = 2400;
const H = 1400;

// Helper to generate distributed 20 spawn points across map quadrants
function generate20SpawnPoints(w: number, h: number, pad = 120): Array<{ x: number; y: number }> {
  return [
    // Top-Left Quadrant
    { x: pad + 100, y: pad + 80 },
    { x: pad + 420, y: pad + 150 },
    { x: pad + 200, y: pad + 450 },
    { x: pad + 600, y: pad + 380 },
    { x: pad + 120, y: pad + 280 },

    // Top-Right Quadrant
    { x: w - pad - 100, y: pad + 80 },
    { x: w - pad - 420, y: pad + 150 },
    { x: w - pad - 200, y: pad + 450 },
    { x: w - pad - 600, y: pad + 380 },
    { x: w - pad - 120, y: pad + 280 },

    // Bottom-Left Quadrant
    { x: pad + 100, y: h - pad - 80 },
    { x: pad + 420, y: h - pad - 150 },
    { x: pad + 200, y: h - pad - 450 },
    { x: pad + 600, y: h - pad - 380 },
    { x: pad + 120, y: h - pad - 280 },

    // Bottom-Right Quadrant
    { x: w - pad - 100, y: h - pad - 80 },
    { x: w - pad - 420, y: h - pad - 150 },
    { x: w - pad - 200, y: h - pad - 450 },
    { x: w - pad - 600, y: h - pad - 380 },
    { x: w - pad - 120, y: h - pad - 280 },
  ];
}

export const ARENAS: Record<string, ArenaConfig> = {
  // ─── 1. Cyber Grid (Original High-Tech) ──────────────────────────────────
  cyber_grid: {
    id: "cyber_grid",
    name: "Cyber Grid",
    description: "Futuristic neon simulation grid with reinforced data pillars and energy barricades.",
    width: W,
    height: H,
    backgroundColor: "#0B0D10",
    gridColor: "rgba(76,141,255,0.05)",
    accentColor: "#4C8DFF",
    ambientParticleColor: "#4C8DFF",
    walls: [
      // Outer boundaries
      { x: 0, y: 0, width: W, height: 32 },
      { x: 0, y: H - 32, width: W, height: 32 },
      { x: 0, y: 0, width: 32, height: H },
      { x: W - 32, y: 0, width: 32, height: H },
      // Central Data Core
      { x: W / 2 - 90, y: H / 2 - 120, width: 180, height: 240 },
      // Outer Quadrant Platforms
      { x: 300, y: 350, width: 260, height: 32 },
      { x: 300, y: H - 382, width: 260, height: 32 },
      { x: W - 560, y: 350, width: 260, height: 32 },
      { x: W - 560, y: H - 382, width: 260, height: 32 },
      // Quarter Columns
      { x: W / 2 - 320, y: 180, width: 36, height: 220 },
      { x: W / 2 + 284, y: 180, width: 36, height: 220 },
      { x: W / 2 - 320, y: H - 400, width: 36, height: 220 },
      { x: W / 2 + 284, y: H - 400, width: 36, height: 220 },
      // Tactical side barriers
      { x: 700, y: H / 2 - 16, width: 180, height: 32 },
      { x: W - 880, y: H / 2 - 16, width: 180, height: 32 },
    ],
    spawnPoints: generate20SpawnPoints(W, H),
  },

  // ─── 2. Void Core (Original Dark Matter) ─────────────────────────────────
  void_core: {
    id: "void_core",
    name: "Void Core",
    description: "An unstable dimensional rift encased in dark matter monoliths and violet rifts.",
    width: W,
    height: H,
    backgroundColor: "#0D0B12",
    gridColor: "rgba(141,99,255,0.05)",
    accentColor: "#8D63FF",
    ambientParticleColor: "#8D63FF",
    walls: [
      { x: 0, y: 0, width: W, height: 32 },
      { x: 0, y: H - 32, width: W, height: 32 },
      { x: 0, y: 0, width: 32, height: H },
      { x: W - 32, y: 0, width: 32, height: H },
      // Dark matter monoliths
      { x: 420, y: 220, width: 100, height: 260 },
      { x: 420, y: H - 480, width: 100, height: 260 },
      { x: W - 520, y: 220, width: 100, height: 260 },
      { x: W - 520, y: H - 480, width: 100, height: 260 },
      // Center void crystals
      { x: W / 2 - 50, y: H / 2 - 140, width: 100, height: 100 },
      { x: W / 2 - 50, y: H / 2 + 40, width: 100, height: 100 },
      // Cross barriers
      { x: W / 2 - 340, y: H / 2 - 16, width: 180, height: 32 },
      { x: W / 2 + 160, y: H / 2 - 16, width: 180, height: 32 },
    ],
    spawnPoints: generate20SpawnPoints(W, H),
  },

  // ─── 3. Industrial Zone (Original Heavy Tech) ────────────────────────────
  industrial_zone: {
    id: "industrial_zone",
    name: "Industrial Zone",
    description: "High-voltage factory floor littered with heavy shipping crates and conveyor ramps.",
    width: W,
    height: H,
    backgroundColor: "#0C1009",
    gridColor: "rgba(54,179,126,0.05)",
    accentColor: "#36B37E",
    ambientParticleColor: "#4ADE80",
    walls: [
      { x: 0, y: 0, width: W, height: 32 },
      { x: 0, y: H - 32, width: W, height: 32 },
      { x: 0, y: 0, width: 32, height: H },
      { x: W - 32, y: 0, width: 32, height: H },
      // Cargo container blocks
      { x: 260, y: 240, width: 140, height: 140 },
      { x: 260, y: H - 380, width: 140, height: 140 },
      { x: W - 400, y: 240, width: 140, height: 140 },
      { x: W - 400, y: H - 380, width: 140, height: 140 },
      // Long factory conveyor catwalks
      { x: 500, y: H / 2 - 16, width: 400, height: 32 },
      { x: W - 900, y: H / 2 - 16, width: 400, height: 32 },
      // Central machinery
      { x: W / 2 - 20, y: 240, width: 40, height: 260 },
      { x: W / 2 - 20, y: H - 500, width: 40, height: 260 },
    ],
    spawnPoints: generate20SpawnPoints(W, H),
  },

  // ─── 4. Outpost (Mini Militia Classic) ──────────────────────────────────
  outpost: {
    id: "outpost",
    name: "Outpost",
    description: "Iconic military jungle outpost with elevated watchtowers, floating sky platforms, and bunker trenches.",
    width: W,
    height: H,
    backgroundColor: "#0B1009",
    gridColor: "rgba(34,197,94,0.05)",
    accentColor: "#22C55E",
    ambientParticleColor: "#4ADE80",
    walls: [
      // Perimeter
      { x: 0, y: 0, width: W, height: 32 },
      { x: 0, y: H - 32, width: W, height: 32 },
      { x: 0, y: 0, width: 32, height: H },
      { x: W - 32, y: 0, width: 32, height: H },
      // Elevated watchtowers (Left & Right)
      { x: 280, y: 160, width: 180, height: 32 },
      { x: 350, y: 192, width: 40, height: 280 },
      { x: W - 460, y: 160, width: 180, height: 32 },
      { x: W - 390, y: 192, width: 40, height: 280 },
      // Center Sky Bridge & Floating platforms
      { x: W / 2 - 280, y: 320, width: 560, height: 36 },
      { x: W / 2 - 160, y: 560, width: 320, height: 32 },
      // Underground bunker & trench covers
      { x: 480, y: H - 320, width: 340, height: 32 },
      { x: W - 820, y: H - 320, width: 340, height: 32 },
      { x: W / 2 - 40, y: H - 288, width: 80, height: 256 },
      // Tactical crate stacks
      { x: 680, y: 220, width: 90, height: 90 },
      { x: W - 770, y: 220, width: 90, height: 90 },
      { x: 780, y: H - 200, width: 80, height: 80 },
      { x: W - 860, y: H - 200, width: 80, height: 80 },
    ],
    spawnPoints: generate20SpawnPoints(W, H),
  },

  // ─── 5. Catacombs (Mini Militia Classic) ────────────────────────────────
  catacombs: {
    id: "catacombs",
    name: "Catacombs",
    description: "Subterranean rock caverns with narrow tunnel mazes, torch-lit chambers, and lethal close-quarters choke points.",
    width: W,
    height: H,
    backgroundColor: "#110A06",
    gridColor: "rgba(249,115,22,0.05)",
    accentColor: "#E05A5A",
    ambientParticleColor: "#F0843A",
    walls: [
      { x: 0, y: 0, width: W, height: 32 },
      { x: 0, y: H - 32, width: W, height: 32 },
      { x: 0, y: 0, width: 32, height: H },
      { x: W - 32, y: 0, width: 32, height: H },
      // Central Cavern Pillars
      { x: W / 2 - 80, y: H / 2 - 200, width: 160, height: 120 },
      { x: W / 2 - 80, y: H / 2 + 80, width: 160, height: 120 },
      // Labyrinth Tunnel partitions
      { x: 260, y: 180, width: 32, height: 420 },
      { x: 260, y: H - 540, width: 32, height: 360 },
      { x: W - 292, y: 180, width: 32, height: 420 },
      { x: W - 292, y: H - 540, width: 32, height: 360 },
      // Horizontal cave ledges
      { x: 420, y: 380, width: 360, height: 36 },
      { x: 420, y: H - 420, width: 360, height: 36 },
      { x: W - 780, y: 380, width: 360, height: 36 },
      { x: W - 780, y: H - 420, width: 360, height: 36 },
      // Choke corridor blocks
      { x: W / 2 - 380, y: H / 2 - 18, width: 180, height: 36 },
      { x: W / 2 + 200, y: H / 2 - 18, width: 180, height: 36 },
    ],
    spawnPoints: generate20SpawnPoints(W, H),
  },

  // ─── 6. High Tower (Mini Militia Classic) ───────────────────────────────
  high_tower: {
    id: "high_tower",
    name: "High Tower",
    description: "Vertical sniper fortress featuring elevated sniper platforms, dual drop chutes, and a central killbox arena.",
    width: W,
    height: H,
    backgroundColor: "#080C11",
    gridColor: "rgba(56,189,248,0.05)",
    accentColor: "#38BDF8",
    ambientParticleColor: "#38BDF8",
    walls: [
      { x: 0, y: 0, width: W, height: 32 },
      { x: 0, y: H - 32, width: W, height: 32 },
      { x: 0, y: 0, width: 32, height: H },
      { x: W - 32, y: 0, width: 32, height: H },
      // Twin Sniper Towers
      { x: 380, y: 140, width: 44, height: 480 },
      { x: 260, y: 140, width: 280, height: 32 },
      { x: W - 424, y: 140, width: 44, height: 480 },
      { x: W - 540, y: 140, width: 280, height: 32 },
      // Central Sky Fort Bridge
      { x: W / 2 - 350, y: 260, width: 700, height: 36 },
      { x: W / 2 - 40, y: 296, width: 80, height: 260 },
      // Mid-tier sniper nests
      { x: 600, y: 520, width: 260, height: 32 },
      { x: W - 860, y: 520, width: 260, height: 32 },
      // Ground Fort Bunkers
      { x: 300, y: H - 280, width: 380, height: 36 },
      { x: W - 680, y: H - 280, width: 380, height: 36 },
      { x: W / 2 - 200, y: H - 360, width: 400, height: 36 },
    ],
    spawnPoints: generate20SpawnPoints(W, H),
  },

  // ─── 7. Pyramid (Mini Militia Classic) ──────────────────────────────────
  pyramid: {
    id: "pyramid",
    name: "Pyramid",
    description: "Desert tomb ruins surrounded by ancient sandstone monuments, stepped burial chambers, and grand royal halls.",
    width: W,
    height: H,
    backgroundColor: "#100C04",
    gridColor: "rgba(234,179,8,0.05)",
    accentColor: "#D4A22A",
    ambientParticleColor: "#D4A22A",
    walls: [
      { x: 0, y: 0, width: W, height: 32 },
      { x: 0, y: H - 32, width: W, height: 32 },
      { x: 0, y: 0, width: 32, height: H },
      { x: W - 32, y: 0, width: 32, height: H },
      // Stepped Pyramid structure (Center)
      { x: W / 2 - 360, y: 180, width: 720, height: 36 },
      { x: W / 2 - 260, y: 340, width: 520, height: 36 },
      { x: W / 2 - 160, y: 500, width: 320, height: 36 },
      // Sandstone Obelisks
      { x: 280, y: 260, width: 80, height: 320 },
      { x: 280, y: H - 540, width: 80, height: 280 },
      { x: W - 360, y: 260, width: 80, height: 320 },
      { x: W - 360, y: H - 540, width: 80, height: 280 },
      // Pharaoh Burial Chambers
      { x: 520, y: H - 360, width: 320, height: 36 },
      { x: W - 840, y: H - 360, width: 320, height: 36 },
      { x: W / 2 - 60, y: H - 320, width: 120, height: 120 },
    ],
    spawnPoints: generate20SpawnPoints(W, H),
  },

  // ─── 8. Lunar Base (Mini Militia Classic) ───────────────────────────────
  lunar_base: {
    id: "lunar_base",
    name: "Lunar Base",
    description: "Deep space lunar outpost situated in an asteroid impact crater with bio-domes, solar arrays, and low-gravity conduits.",
    width: W,
    height: H,
    backgroundColor: "#080A12",
    gridColor: "rgba(139,92,246,0.05)",
    accentColor: "#A855F7",
    ambientParticleColor: "#A855F7",
    walls: [
      { x: 0, y: 0, width: W, height: 32 },
      { x: 0, y: H - 32, width: W, height: 32 },
      { x: 0, y: 0, width: 32, height: H },
      { x: W - 32, y: 0, width: 32, height: H },
      // Central Bio-Dome Station
      { x: W / 2 - 120, y: H / 2 - 120, width: 240, height: 240 },
      // Orbital solar arrays
      { x: 300, y: 240, width: 340, height: 32 },
      { x: 300, y: H - 300, width: 340, height: 32 },
      { x: W - 640, y: 240, width: 340, height: 32 },
      { x: W - 640, y: H - 300, width: 340, height: 32 },
      // Airlock blast doors
      { x: 440, y: H / 2 - 120, width: 40, height: 240 },
      { x: W - 480, y: H / 2 - 120, width: 40, height: 240 },
      // Radar antenna towers
      { x: W / 2 - 20, y: 160, width: 40, height: 140 },
      { x: W / 2 - 20, y: H - 300, width: 40, height: 140 },
    ],
    spawnPoints: generate20SpawnPoints(W, H),
  },
};
