import { prisma } from "@/lib/prisma";
import { mapDbHero, type HeroData, type HeroRole } from "@/lib/heroes";
import type { GameRole } from "@/components/HeroCard";

export async function listHeroes(): Promise<HeroData[]> {
  const rows = await prisma.hero.findMany({
    orderBy: [{ gameRole: "asc" }, { nameEn: "asc" }],
  });
  return rows.map(mapDbHero);
}

export async function getHeroByName(nameEn: string): Promise<HeroData | null> {
  const row = await prisma.hero.findUnique({ where: { nameEn } });
  return row ? mapDbHero(row) : null;
}

export async function getHeroRoleMap(): Promise<Map<string, GameRole>> {
  const rows = await prisma.hero.findMany({
    select: { nameEn: true, gameRole: true },
  });
  return new Map(
    rows.map((row) => [row.nameEn, row.gameRole as GameRole])
  );
}

export function buildHeroRoleMapFromActions(
  base: Map<string, GameRole>,
  actions: { heroName: string | null; gameRole: string | null }[]
) {
  const map = new Map(base);
  for (const action of actions) {
    if (action.heroName && action.gameRole) {
      map.set(action.heroName, action.gameRole as GameRole);
    }
  }
  return map;
}

export type { HeroData, HeroRole };
