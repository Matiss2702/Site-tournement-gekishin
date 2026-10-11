import type { GameRole } from "@/components/HeroCard";
import { shuffleArray } from "@/lib/bracket";
import { getBansPerRole } from "@/lib/draft-turn-order";

export type HeroOrderByRole = Record<GameRole, string[]>;

const ROLES: GameRole[] = ["TANK", "SUPPORT", "DPS"];

export function buildShuffledHeroOrder(
  heroes: { nameEn: string; gameRole: GameRole }[]
): HeroOrderByRole {
  const order: HeroOrderByRole = { TANK: [], SUPPORT: [], DPS: [] };
  for (const role of ROLES) {
    order[role] = shuffleArray(
      heroes.filter((h) => h.gameRole === role).map((h) => h.nameEn)
    );
  }
  return order;
}

export function parseHeroOrderJson(raw: unknown): HeroOrderByRole | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const order: HeroOrderByRole = { TANK: [], SUPPORT: [], DPS: [] };
  for (const role of ROLES) {
    const list = obj[role];
    if (!Array.isArray(list) || !list.every((x) => typeof x === "string")) {
      return null;
    }
    order[role] = list as string[];
  }
  return order;
}

/** First banable hero for a team, walking roles TANK → SUPPORT → DPS in display order. */
export function pickAutoBanHeroName(input: {
  heroOrder: HeroOrderByRole;
  bannedNames: Set<string>;
  teamBanCounts: Record<GameRole, number>;
}): string | null {
  for (const role of ROLES) {
    if (input.teamBanCounts[role] >= getBansPerRole(role)) continue;
    for (const name of input.heroOrder[role]) {
      if (!input.bannedNames.has(name)) return name;
    }
  }
  return null;
}

export function sortHeroesByOrder<T extends { nameEn: string; gameRole: GameRole }>(
  heroes: T[],
  order: HeroOrderByRole | null
): T[] {
  if (!order) return heroes;
  const index = new Map<string, number>();
  for (const role of ROLES) {
    order[role].forEach((name, i) => index.set(name, i));
  }
  return [...heroes].sort((a, b) => {
    if (a.gameRole !== b.gameRole) {
      return ROLES.indexOf(a.gameRole) - ROLES.indexOf(b.gameRole);
    }
    return (index.get(a.nameEn) ?? 999) - (index.get(b.nameEn) ?? 999);
  });
}
