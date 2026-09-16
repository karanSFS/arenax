// ═══════════════════════════════════════════
// CHARACTER CONFIG
// All character definitions for client-side use
// ═══════════════════════════════════════════

export interface CharacterAbility {
  name: string;
  description: string;
  type: "projectile" | "melee" | "dash" | "buff" | "aoe";
  damage: number;
  range: number;
  cooldown: number;
}

export interface CharacterDef {
  slug: string;
  name: string;
  role: "melee" | "ranged" | "tank" | "assassin";
  description: string;
  stats: {
    health: number;
    speed: number;
    attack: number;
    defense: number;
  };
  abilities: {
    primary: CharacterAbility;
    secondary: CharacterAbility;
    tactical?: CharacterAbility;
    ultimate: CharacterAbility;
  };
  color: string;
  accentColor: string;
}

export const CHARACTER_DATA: CharacterDef[] = [
  {
    slug: "blaze",
    name: "BLAZE",
    role: "melee",
    description: "A relentless brawler who excels at close-quarters combat. High damage output with powerful melee strikes and a devastating fire dash.",
    stats: { health: 130, speed: 9, attack: 22, defense: 8 },
    color: "#ff6b00",
    accentColor: "#ff2d00",
    abilities: {
      primary: {
        name: "Inferno Blast",
        description: "Launch a blazing thermal projectile that scorches enemies on impact.",
        type: "projectile",
        damage: 34,
        range: 650,
        cooldown: 0.38,
      },
      secondary: {
        name: "Fire Dash",
        description: "Dash forward at blazing speed, leaving a trail of fire.",
        type: "dash",
        damage: 20,
        range: 320,
        cooldown: 4,
      },
      tactical: {
        name: "Flame Burst",
        description: "Unleash a 3-way spread of fiery thermal projectiles.",
        type: "projectile",
        damage: 42,
        range: 580,
        cooldown: 5.5,
      },
      ultimate: {
        name: "Conflagration",
        description: "Erupt in a massive fire explosion that damages all nearby enemies.",
        type: "aoe",
        damage: 80,
        range: 160,
        cooldown: 15,
      },
    },
  },
  {
    slug: "volt",
    name: "VOLT",
    role: "ranged",
    description: "A cybernetic marksman who dominates at range. Precise projectiles and a charged energy blast make her deadly from afar.",
    stats: { health: 100, speed: 10, attack: 18, defense: 5 },
    color: "#00f5ff",
    accentColor: "#0080ff",
    abilities: {
      primary: {
        name: "Plasma Bolt",
        description: "Fire a high-velocity plasma projectile at the cursor position.",
        type: "projectile",
        damage: 28,
        range: 800,
        cooldown: 0.35,
      },
      secondary: {
        name: "Volt Warp",
        description: "Teleport dash instantly in the direction you are facing.",
        type: "dash",
        damage: 15,
        range: 360,
        cooldown: 4,
      },
      tactical: {
        name: "Arc Shot",
        description: "Launch a charged piercing lightning shot that slices through opponents.",
        type: "projectile",
        damage: 55,
        range: 750,
        cooldown: 5,
      },
      ultimate: {
        name: "Thunderstrike",
        description: "Call down a massive lightning strike in a wide area.",
        type: "aoe",
        damage: 90,
        range: 170,
        cooldown: 18,
      },
    },
  },
  {
    slug: "titan",
    name: "TITAN",
    role: "tank",
    description: "An armored juggernaut with immense health and a powerful shield. Slow but nearly unkillable — designed to absorb punishment and control space.",
    stats: { health: 160, speed: 6, attack: 15, defense: 14 },
    color: "#39ff14",
    accentColor: "#20d010",
    abilities: {
      primary: {
        name: "Kinetic Cannon",
        description: "Fire a heavy explosive kinetic rocket dealing concussive damage.",
        type: "projectile",
        damage: 38,
        range: 620,
        cooldown: 0.48,
      },
      secondary: {
        name: "Iron Shield",
        description: "Activate a defensive energy barrier reducing incoming damage.",
        type: "buff",
        damage: 0,
        range: 0,
        cooldown: 5.5,
      },
      tactical: {
        name: "Shockwave Slam",
        description: "Slam the ground sending a concussive shockwave ring into nearby foes.",
        type: "aoe",
        damage: 48,
        range: 150,
        cooldown: 6,
      },
      ultimate: {
        name: "Meteor Crash",
        description: "Slam down with catastrophic seismic force, devastating a huge zone.",
        type: "aoe",
        damage: 95,
        range: 220,
        cooldown: 20,
      },
    },
  },
  {
    slug: "phantom",
    name: "PHANTOM",
    role: "assassin",
    description: "A deadly shadow operative who strikes from stealth. Low health but can vanish and unleash devastating surprise attacks.",
    stats: { health: 90, speed: 12, attack: 25, defense: 4 },
    color: "#bf5fff",
    accentColor: "#9933ff",
    abilities: {
      primary: {
        name: "Shadow Blade",
        description: "Hurl a spectral blade that phases toward your target.",
        type: "projectile",
        damage: 32,
        range: 650,
        cooldown: 0.38,
      },
      secondary: {
        name: "Vanish",
        description: "Disappear into shadow for 3.5 seconds, becoming untargetable.",
        type: "buff",
        damage: 0,
        range: 0,
        cooldown: 7.5,
      },
      tactical: {
        name: "Shadow Daggers",
        description: "Hurl twin high-speed penetrating shadow blades.",
        type: "projectile",
        damage: 50,
        range: 700,
        cooldown: 5,
      },
      ultimate: {
        name: "Death Mark",
        description: "Fire a lethal spectral missile dealing massive damage on impact.",
        type: "dash",
        damage: 100,
        range: 650,
        cooldown: 20,
      },
    },
  },
];

export interface AchievementDef {
  name: string;
  slug: string;
  description: string;
  icon: string;
  requirement: {
    type: string;
    count: number;
  };
  xpReward: number;
  coinReward: number;
}

export const ACHIEVEMENT_DATA: AchievementDef[] = [
  {
    name: "First Blood",
    slug: "first-blood",
    description: "Score your first kill in ARENAX",
    icon: "Swords",
    requirement: { type: "kills", count: 1 },
    xpReward: 100,
    coinReward: 50,
  },
  {
    name: "Sharpshooter",
    slug: "sharpshooter",
    description: "Eliminate 10 opponents in combat",
    icon: "Target",
    requirement: { type: "kills", count: 10 },
    xpReward: 250,
    coinReward: 120,
  },
  {
    name: "Unstoppable",
    slug: "unstoppable",
    description: "Win 5 matches in the arena",
    icon: "Trophy",
    requirement: { type: "wins", count: 5 },
    xpReward: 500,
    coinReward: 300,
  },
  {
    name: "Arena Champion",
    slug: "arena-champion",
    description: "Win 25 matches and dominate the leaderboards",
    icon: "Crown",
    requirement: { type: "wins", count: 25 },
    xpReward: 2000,
    coinReward: 1000,
  },
  {
    name: "Veteran Warrior",
    slug: "veteran-warrior",
    description: "Reach Player Level 10",
    icon: "Shield",
    requirement: { type: "level", count: 10 },
    xpReward: 1000,
    coinReward: 500,
  },
  {
    name: "Rampage",
    slug: "rampage",
    description: "Eliminate 50 opponents total",
    icon: "Flame",
    requirement: { type: "kills", count: 50 },
    xpReward: 1500,
    coinReward: 750,
  },
  {
    name: "Berserker",
    slug: "berserker",
    description: "Deal over 5,000 total damage",
    icon: "Zap",
    requirement: { type: "damage", count: 5000 },
    xpReward: 800,
    coinReward: 400,
  },
];
