"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { HeroData, HeroRole } from "@/lib/heroes";
import { HeroCard } from "@/components/HeroCard";
import { HeroDetailModal } from "@/components/HeroDetailModal";

const ROLES: Array<HeroRole | "ALL"> = ["ALL", "TANK", "SUPPORT", "DPS"];

export function HeroesCatalog() {
  const t = useTranslations("heroes");
  const tRoles = useTranslations("roles");
  const locale = useLocale();
  const isFr = locale.startsWith("fr");
  const [heroes, setHeroes] = useState<HeroData[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<HeroRole | "ALL">("ALL");
  const [selected, setSelected] = useState<HeroData | null>(null);

  useEffect(() => {
    fetch("/api/heroes")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setHeroes(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const list =
      roleFilter === "ALL"
        ? heroes
        : heroes.filter((hero) => hero.gameRole === roleFilter);
    return [...list].sort((a, b) => {
      const an = isFr ? a.nameFr : a.nameEn;
      const bn = isFr ? b.nameFr : b.nameEn;
      return an.localeCompare(bn, locale);
    });
  }, [heroes, roleFilter, isFr, locale]);

  if (loading) {
    return <p className="text-sm text-muted">{t("loading")}</p>;
  }

  if (heroes.length === 0) {
    return <p className="text-sm text-muted">{t("empty")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(role)}
            className={`btn text-sm py-1.5 px-3 ${
              roleFilter === role ? "btn-primary" : "btn-secondary"
            }`}
          >
            {role === "ALL" ? t("allRoles") : tRoles(role)}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted">
        {t("count", { count: filtered.length })} · {t("tapHint")}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((hero) => (
          <HeroCard
            key={hero.id}
            name={isFr ? hero.nameFr : hero.nameEn}
            role={hero.gameRole}
            roleLabel={tRoles(hero.gameRole)}
            imageUrl={hero.imageUrl}
            onClick={() => setSelected(hero)}
          />
        ))}
      </div>

      {selected && (
        <HeroDetailModal hero={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
