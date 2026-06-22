"use client";

import { useTranslations } from "next-intl";

interface DraftPhaseTransitionProps {
  active: boolean;
}

export function DraftPhaseTransition({ active }: DraftPhaseTransitionProps) {
  const t = useTranslations("draft");

  if (!active) return null;

  return (
    <div className="draft-phase-transition" aria-live="assertive" role="status">
      <div className="draft-phase-transition-vignette" />
      <div className="draft-phase-transition-beam" />
      <div className="draft-phase-transition-content">
        <span className="draft-phase-transition-from">{t("heroBan")}</span>
        <span className="draft-phase-transition-arrow" aria-hidden>
          →
        </span>
        <span className="draft-phase-transition-to">{t("phaseTransitionPick")}</span>
        <p className="draft-phase-transition-sub">{t("phaseTransitionSub")}</p>
      </div>
    </div>
  );
}
