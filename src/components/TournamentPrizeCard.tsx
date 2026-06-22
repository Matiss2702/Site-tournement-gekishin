"use client";

import { useTranslations } from "next-intl";

interface TournamentPrizeCardProps {
  placement: number;
  code: string;
  teamName?: string | null;
}

export function TournamentPrizeCard({
  placement,
  code,
  teamName,
}: TournamentPrizeCardProps) {
  const t = useTranslations("tournaments");

  return (
    <div className="card border-accent/40 bg-accent/5">
      <p className="text-sm text-muted">{t(`prizePlacement.${placement}`)}</p>
      {teamName && (
        <p className="text-sm font-medium mt-1">{teamName}</p>
      )}
      <p className="mt-3 text-2xl font-mono tracking-widest break-all">{code}</p>
      <p className="text-xs text-muted mt-2">{t("prizeCodeHint")}</p>
    </div>
  );
}
