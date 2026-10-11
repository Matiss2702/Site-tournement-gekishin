"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { HeroData, HeroSkillType } from "@/lib/heroes";
import { officialHeroUrl } from "@/lib/heroes";

const skillTypeLabelKey: Record<HeroSkillType, string> = {
  PASSIVE: "skillPassive",
  RUSH: "skillRush",
  SKILL: "skillActive",
  SUPER: "skillSuper",
  TRANSFORM: "skillTransform",
};

interface HeroDetailModalProps {
  hero: HeroData;
  onClose: () => void;
}

export function HeroDetailModal({ hero, onClose }: HeroDetailModalProps) {
  const t = useTranslations("heroes");
  const tRoles = useTranslations("roles");
  const locale = useLocale();
  const isFr = locale.startsWith("fr");
  const name = isFr ? hero.nameFr : hero.nameEn;
  const summary = isFr ? hero.summaryFr : hero.summaryEn;
  const skills = hero.skills ?? [];
  const officialUrl = hero.officialId
    ? officialHeroUrl(locale, hero.officialId)
    : "https://dbg-squadra.bn-ent.net/fr/hero";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-xl border-card-border"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hero-detail-title"
      >
        <div className="relative h-44 sm:h-56 overflow-hidden rounded-t-2xl sm:rounded-t-xl">
          {hero.imageUrl && (
            <Image
              src={hero.imageUrl}
              alt=""
              fill
              className="object-cover object-top"
              sizes="(max-width: 640px) 100vw, 42rem"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 btn btn-secondary text-sm py-1 px-3"
          >
            {t("close")}
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <span className="badge bg-primary/20 text-primary mb-2">
              {tRoles(hero.gameRole)}
            </span>
            <h2 id="hero-detail-title" className="text-2xl font-bold">
              {name}
            </h2>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {summary ? (
            <p className="text-sm text-foreground/85 leading-relaxed">{summary}</p>
          ) : (
            <p className="text-sm text-muted">{t("noSummary")}</p>
          )}

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
              {t("skills")}
            </h3>
            {skills.length === 0 ? (
              <p className="text-sm text-muted">{t("skillsComingSoon")}</p>
            ) : (
              <ul className="space-y-3">
                {skills.map((skill) => (
                  <li
                    key={`${skill.type}-${skill.nameEn}`}
                    className="rounded-lg border border-card-border bg-background/40 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="badge bg-card-border text-muted text-xs">
                        {t(skillTypeLabelKey[skill.type])}
                      </span>
                      <span className="font-medium text-sm">
                        {isFr ? skill.nameFr : skill.nameEn}
                      </span>
                    </div>
                    <p className="text-sm text-muted leading-relaxed">
                      {isFr ? skill.descriptionFr : skill.descriptionEn}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary w-full sm:w-auto inline-flex justify-center"
          >
            {t("viewOfficial")}
          </a>
          <p className="text-xs text-muted">{t("officialDisclaimer")}</p>
        </div>
      </div>
    </div>
  );
}
