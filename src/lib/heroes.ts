export type HeroRole = "TANK" | "SUPPORT" | "DPS";

export type HeroSkillType =
  | "PASSIVE"
  | "RUSH"
  | "SKILL"
  | "SUPER"
  | "TRANSFORM";

export interface HeroSkill {
  type: HeroSkillType;
  nameEn: string;
  nameFr: string;
  descriptionEn: string;
  descriptionFr: string;
}

export interface HeroData {
  id: string;
  nameEn: string;
  nameFr: string;
  gameRole: HeroRole;
  imageUrl: string | null;
  officialId?: string | null;
  summaryEn?: string | null;
  summaryFr?: string | null;
  skills?: HeroSkill[];
}

export function officialHeroUrl(locale: string, officialId: string) {
  const lang = locale.startsWith("fr") ? "fr" : "en-us";
  return `https://dbg-squadra.bn-ent.net/${lang}/hero/${officialId}`;
}

export function parseHeroSkills(value: unknown): HeroSkill[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is HeroSkill => {
    if (!row || typeof row !== "object") return false;
    const skill = row as Record<string, unknown>;
    return (
      typeof skill.type === "string" &&
      typeof skill.nameEn === "string" &&
      typeof skill.nameFr === "string" &&
      typeof skill.descriptionEn === "string" &&
      typeof skill.descriptionFr === "string"
    );
  });
}

export function mapDbHero(row: {
  id: string;
  nameEn: string;
  nameFr: string;
  gameRole: string;
  imageUrl: string | null;
  officialId?: string | null;
  summaryEn?: string | null;
  summaryFr?: string | null;
  skills?: unknown;
}): HeroData {
  return {
    id: row.id,
    nameEn: row.nameEn,
    nameFr: row.nameFr,
    gameRole: row.gameRole as HeroRole,
    imageUrl: row.imageUrl,
    officialId: row.officialId ?? null,
    summaryEn: row.summaryEn ?? null,
    summaryFr: row.summaryFr ?? null,
    skills: parseHeroSkills(row.skills),
  };
}
