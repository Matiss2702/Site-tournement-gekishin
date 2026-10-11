import { prisma } from "@/lib/prisma";
import { listHeroes } from "@/lib/hero-repository";
import {
  countHeroBansByRole,
} from "@/lib/draft";
import {
  buildShuffledHeroOrder,
  parseHeroOrderJson,
  pickAutoBanHeroName,
} from "@/lib/draft-hero-order";
import { executeDraftAction } from "@/lib/draft-actions";
import { getActiveTeamId } from "@/lib/draft-turn-order";
import type { GameRole } from "@/components/HeroCard";

export async function ensureDraftHeroOrder(matchId: string) {
  const draft = await prisma.draftConfig.findUnique({ where: { matchId } });
  if (!draft) return null;
  if (parseHeroOrderJson(draft.heroOrderJson)) return draft;

  const heroes = await listHeroes();
  const heroOrderJson = buildShuffledHeroOrder(
    heroes.map((h) => ({ nameEn: h.nameEn, gameRole: h.gameRole as GameRole }))
  );

  return prisma.draftConfig.update({
    where: { matchId },
    data: { heroOrderJson },
  });
}

/** If ban turn timer expired, auto-ban next hero from shuffled role lists. */
export async function applyBanTimeoutIfNeeded(matchId: string) {
  const draft = await ensureDraftHeroOrder(matchId);
  if (!draft?.isActive) return { applied: false as const };
  if (draft.currentPhase !== "HERO_BAN") return { applied: false as const };
  if (!draft.team1Id || !draft.team2Id) return { applied: false as const };

  if (!draft.turnStartedAt) {
    await prisma.draftConfig.update({
      where: { matchId },
      data: { turnStartedAt: new Date() },
    });
    return {
      applied: false as const,
      remainingSeconds: draft.banTimeSeconds || 45,
    };
  }

  const limitMs = (draft.banTimeSeconds || 45) * 1000;
  const elapsed = Date.now() - draft.turnStartedAt.getTime();
  if (elapsed < limitMs) {
    return {
      applied: false as const,
      remainingSeconds: Math.max(0, Math.ceil((limitMs - elapsed) / 1000)),
    };
  }

  const actions = await prisma.draftAction_.findMany({
    where: { matchId },
    orderBy: { order: "asc" },
  });

  const activeTeamId = getActiveTeamId(
    "HERO_BAN",
    actions,
    draft.team1Id,
    draft.team2Id
  );
  if (!activeTeamId) return { applied: false as const };

  const heroOrder =
    parseHeroOrderJson(draft.heroOrderJson) ??
    buildShuffledHeroOrder([]);

  const bannedNames = new Set(
    actions.filter((a) => a.action === "BAN" && a.heroName).map((a) => a.heroName!)
  );

  const heroRoleByName = new Map(
    (await listHeroes()).map((h) => [h.nameEn, h.gameRole as GameRole])
  );
  const teamBanCounts = countHeroBansByRole(
    actions,
    heroRoleByName,
    activeTeamId
  );

  const heroName = pickAutoBanHeroName({
    heroOrder,
    bannedNames,
    teamBanCounts,
  });
  if (!heroName) return { applied: false as const };

  const result = await executeDraftAction(matchId, {
    action: "BAN",
    phase: "HERO_BAN",
    heroName,
    teamId: activeTeamId,
  });

  if ("error" in result && result.error) {
    return { applied: false as const, error: result.error };
  }

  return { applied: true as const, heroName, teamId: activeTeamId };
}
