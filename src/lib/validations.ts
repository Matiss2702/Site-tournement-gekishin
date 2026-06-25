import { z } from "zod";
import { PRIZE_CODES_PER_TEAM } from "@/lib/tournament-prize-config";
import {
  isValidSoloPlayerCapacity,
  isValidTournamentCapacity,
} from "@/lib/tournament-capacity";

const USERNAME_PATTERN = /^[a-zA-Z0-9_ ]+$/;

function usernameSchema() {
  return z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(USERNAME_PATTERN)
    .refine((value) => /[a-zA-Z0-9_]/.test(value), {
      message: "invalid_username",
    });
}

export const registerSchema = z.object({
  email: z.string().email(),
  username: usernameSchema(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(50).optional(),
  locale: z.enum(["en", "fr"]).default("en"),
  inviteToken: z.string().optional(),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

export const tournamentSchema = z
  .object({
    title: z.string().min(3).max(100),
    description: z.string().min(3).max(5000),
    type: z.enum(["SOLO", "TEAM"]),
    format: z
      .enum(["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION"])
      .default("SINGLE_ELIMINATION"),
    maxTeams: z.number().int().optional(),
    maxPlayers: z.number().int().optional(),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    prizeCodes: z
      .array(
        z.object({
          placement: z.number().int().min(1).max(3),
          code: z.string().trim().min(4).max(120),
        })
      )
      .optional()
      .default([]),
    roundSeriesLength: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(1),
    semiSeriesLength: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(1),
    finalSeriesLength: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(1),
  })
  .superRefine((data, ctx) => {
    if (data.type === "TEAM" && data.maxTeams == null) {
      ctx.addIssue({
        code: "custom",
        message: "maxTeams_required",
        path: ["maxTeams"],
      });
    }
    if (data.type === "SOLO" && data.maxPlayers == null) {
      ctx.addIssue({
        code: "custom",
        message: "maxPlayers_required",
        path: ["maxPlayers"],
      });
    }
    if (
      data.type === "TEAM" &&
      data.maxTeams != null &&
      !isValidTournamentCapacity(data.maxTeams)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "invalid_capacity",
        path: ["maxTeams"],
      });
    }
    if (
      data.type === "SOLO" &&
      data.maxPlayers != null &&
      !isValidSoloPlayerCapacity(data.maxPlayers)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "invalid_capacity",
        path: ["maxPlayers"],
      });
    }

    const placements = data.prizeCodes.map((row) => row.placement);
    const codes = data.prizeCodes.map((row) => row.code);
    if (new Set(codes).size !== codes.length) {
      ctx.addIssue({
        code: "custom",
        message: "prize_code_duplicate",
        path: ["prizeCodes"],
      });
    }

    if (data.type === "TEAM" && data.prizeCodes.length > 0) {
      for (const placement of [1, 2, 3]) {
        const count = placements.filter((p) => p === placement).length;
        if (count > 0 && count !== PRIZE_CODES_PER_TEAM) {
          ctx.addIssue({
            code: "custom",
            message: "prize_codes_per_placement",
            path: ["prizeCodes"],
          });
          break;
        }
      }
    }

    if (data.type === "SOLO" && data.prizeCodes.length > 0) {
      for (const placement of [1, 2, 3]) {
        const count = placements.filter((p) => p === placement).length;
        if (count > 0 && count !== PRIZE_CODES_PER_TEAM) {
          ctx.addIssue({
            code: "custom",
            message: "prize_codes_per_placement",
            path: ["prizeCodes"],
          });
          break;
        }
      }
    }
  });

export const teamSchema = z.object({
  name: z.string().trim().min(2).max(50),
  tag: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(2).max(6).optional()
  ),
});

export const teamInviteSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    username: usernameSchema()
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((data) => data.email || data.username, {
    message: "Email or username is required",
  });

export const scoreUpdateSchema = z.object({
  matchId: z.string(),
  score1: z.number().int().min(0),
  score2: z.number().int().min(0),
  winnerId: z.string().optional(),
});

export const roleBanSchema = z.object({
  userId: z.string(),
  gameRole: z.enum(["TANK", "SUPPORT", "DPS"]),
  reason: z.string().max(500).optional(),
});

export const draftActionSchema = z.object({
  action: z.enum(["BAN", "PICK"]),
  phase: z.enum(["HERO_BAN", "HERO_PICK"]),
  gameRole: z.enum(["TANK", "SUPPORT", "DPS"]).optional(),
  heroName: z.string().optional(),
  teamId: z.string().optional(),
});
