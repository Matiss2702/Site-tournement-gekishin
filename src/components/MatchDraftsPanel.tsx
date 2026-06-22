"use client";

import { useCallback, useEffect, useState } from "react";
import { BRACKET_UPDATED_EVENT } from "@/lib/tournament-events";
import { GRAND_FINAL_ROUND, sortDraftRounds } from "@/lib/draft-round-sort";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

type DraftRow = {
  id: string;
  matchId: string | null;
  isActive: boolean;
  draftComplete?: boolean;
  currentPhase: string;
  spectatorToken: string | null;
  team1Token: string | null;
  team2Token: string | null;
  team1: { id: string; name: string; tag: string | null } | null;
  team2: { id: string; name: string; tag: string | null } | null;
  match: {
    id: string;
    round: number;
    matchNumber: number;
    status: string;
    winnerId?: string | null;
    winner?: { id: string; name: string; tag: string | null } | null;
  } | null;
};

function draftStatusLabel(draft: DraftRow, t: (key: string) => string) {
  if (draft.isActive) {
    return draft.currentPhase === "HERO_PICK" ? t("heroPick") : t("heroBan");
  }
  if (draft.draftComplete) {
    return draft.match?.status === "completed"
      ? t("draftAndMatchComplete")
      : t("draftComplete");
  }
  if (draft.match?.status === "completed") {
    return t("matchComplete");
  }
  return t("waitingForStart");
}

interface MatchDraftsPanelProps {
  tournamentId: string;
  canManage: boolean;
}

export function MatchDraftsPanel({
  tournamentId,
  canManage,
}: MatchDraftsPanelProps) {
  const t = useTranslations("draft");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchDrafts = useCallback(async (sync = false) => {
    const res = await fetch(
      `/api/tournaments/${tournamentId}/drafts${sync ? "?sync=1" : ""}`
    );
    if (res.ok) {
      const data = await res.json();
      setDrafts(data.drafts ?? []);
      setCurrentRound(data.currentRound ?? null);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  useEffect(() => {
    function onBracketUpdated(event: Event) {
      const detail = (event as CustomEvent<{ tournamentId: string }>).detail;
      if (detail?.tournamentId === tournamentId) {
        fetchDrafts(true);
      }
    }

    window.addEventListener(BRACKET_UPDATED_EVENT, onBracketUpdated);
    return () =>
      window.removeEventListener(BRACKET_UPDATED_EVENT, onBracketUpdated);
  }, [tournamentId, fetchDrafts]);

  async function launchDrafts() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tournaments/${tournamentId}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "launch" }),
    });
    if (res.ok) {
      const data = await res.json();
      setDrafts(data.drafts ?? []);
      setCurrentRound(data.round ?? currentRound);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("launchFailed"));
    }
    setBusy(false);
  }

  function roundLabel(round: number) {
    if (round === 0) return t("grandFinalRound");
    if (round < 0) return t("losersRound", { n: Math.abs(round) });
    if (round === 1) return t("tour1");
    return t("roundLabel", { round });
  }

  const grouped = drafts.reduce<Record<number, DraftRow[]>>((acc, draft) => {
    const round = draft.match?.round ?? 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(draft);
    return acc;
  }, {});

  const rounds = Object.keys(grouped)
    .map(Number)
    .sort(sortDraftRounds);

  const regularRounds = rounds.filter((r) => r !== GRAND_FINAL_ROUND);
  const hasGrandFinal = rounds.includes(GRAND_FINAL_ROUND);

  function renderDraftRow(draft: DraftRow) {
    return (
      <div
        key={draft.id}
        className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-card-border last:border-0"
      >
        <div>
          <p className="font-medium">
            {draft.team1?.name}
            {draft.team1?.tag ? ` [${draft.team1.tag}]` : ""}{" "}
            {t("vs")}{" "}
            {draft.team2?.name}
            {draft.team2?.tag ? ` [${draft.team2.tag}]` : ""}
          </p>
          <p className="text-xs text-muted">
            {t("matchLabel", { number: draft.match?.matchNumber ?? "?" })}
            {" · "}
            {draftStatusLabel(draft, t)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {draft.spectatorToken && (
            <Link
              href={`/tournaments/${tournamentId}/draft/watch/${draft.spectatorToken}`}
              className="btn btn-secondary text-sm py-1 px-3"
            >
              {t("spectatorView")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  function renderRoundSection(round: number, highlight = false) {
    const roundDrafts = grouped[round];
    const isComplete =
      highlight &&
      roundDrafts.every(
        (d) =>
          d.draftComplete &&
          (d.match?.status === "completed" || d.match?.status === "bye")
      );
    const champion = roundDrafts.find((d) => d.match?.winner)?.match?.winner;

    return (
      <div
        key={round}
        className={
          highlight
            ? `card space-y-3 draft-grand-final-card${isComplete ? " draft-grand-final-complete" : ""}`
            : "card space-y-3"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            className={
              highlight
                ? "draft-grand-final-title"
                : "text-sm font-semibold uppercase tracking-wider text-muted"
            }
          >
            {highlight ? `🏆 ${roundLabel(round)}` : roundLabel(round)}
          </h3>
          {isComplete && (
            <span className="draft-grand-final-badge">{t("grandFinalComplete")}</span>
          )}
        </div>
        {isComplete && champion && (
          <p className="draft-grand-final-champion">
            {t("grandFinalChampion", {
              team: `${champion.name}${champion.tag ? ` [${champion.tag}]` : ""}`,
            })}
          </p>
        )}
        {roundDrafts.map(renderDraftRow)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={launchDrafts}
            disabled={busy || currentRound == null}
            className="btn btn-primary"
          >
            {busy ? "..." : t("launchRoundDrafts")}
          </button>
          {currentRound != null && (
            <p className="text-sm text-muted">
              {t("currentDraftRound", { round: roundLabel(currentRound) })}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {drafts.length === 0 ? (
        <p className="text-sm text-muted">{t("noMatchDrafts")}</p>
      ) : (
        <>
          {regularRounds.map((round) => renderRoundSection(round))}
          {hasGrandFinal && renderRoundSection(GRAND_FINAL_ROUND, true)}
        </>
      )}
    </div>
  );
}
