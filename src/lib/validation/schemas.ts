import { z } from "zod";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username cannot exceed 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

// ─── Profile ──────────────────────────────────────────────────────────────────
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(30).optional(),
  bio: z.string().max(200).optional(),
  avatar: z.string().max(100).optional(),
});

// ─── Room ─────────────────────────────────────────────────────────────────────
export const CreateRoomSchema = z.object({
  gameMode: z.enum(["QUICK_MATCH", "PRIVATE_ROOM", "PRACTICE"]),
  arena: z.enum(["cyber_grid", "void_core", "industrial_zone"]).optional(),
  maxPlayers: z.number().int().min(2).max(4).optional(),
  characterId: z.string().min(1, "Character is required"),
});

export const JoinRoomSchema = z.object({
  roomCode: z
    .string()
    .regex(/^AX-[A-Z0-9]{4}$/, "Invalid room code format"),
  characterId: z.string().min(1, "Character is required"),
});

// ─── Match ────────────────────────────────────────────────────────────────────
export const CompleteMatchSchema = z.object({
  matchId: z.string().min(1),
  winnerId: z.string().min(1),
  players: z.array(
    z.object({
      userId: z.string(),
      characterId: z.string(),
      kills: z.number().int().min(0).max(100),
      deaths: z.number().int().min(0).max(100),
      damage: z.number().int().min(0).max(100000),
      score: z.number().int().min(0).max(100000),
    })
  ),
  duration: z.number().int().min(0).max(3600),
  arena: z.string(),
  gameMode: z.string(),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
export const UpdateSettingsSchema = z.object({
  audio: z
    .object({
      master: z.number().min(0).max(100),
      music: z.number().min(0).max(100),
      sfx: z.number().min(0).max(100),
    })
    .optional(),
  graphics: z
    .object({
      quality: z.enum(["low", "medium", "high"]),
      particles: z.boolean(),
      screenShake: z.boolean(),
    })
    .optional(),
  controls: z
    .object({
      layout: z.enum(["default", "alternative"]),
    })
    .optional(),
  gameplay: z
    .object({
      vibration: z.boolean(),
      screenShake: z.boolean(),
      showDamageNumbers: z.boolean(),
    })
    .optional(),
});

// ─── Helper ───────────────────────────────────────────────────────────────────
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type JoinRoomInput = z.infer<typeof JoinRoomSchema>;
export type CompleteMatchInput = z.infer<typeof CompleteMatchSchema>;
