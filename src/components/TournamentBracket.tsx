"use client";

import "./tournament-bracket.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  buildGrandFinalRound,
  buildLosersRounds,
  buildWinnersRounds,
  chunkPairs,
  getBracketSize,
  getFeederMatchNumbers,
  getGlobalMatchNumber,
  getLosersFeederMatchNumbers,
  type BracketDisplayMatch,
} from "@/lib/bracket";
import { validateSeriesScore } from "@/lib/match-series";
import { notifyBracketUpdated } from "@/lib/tournament-events";

type Participant = {
  id: string;
  name: string;
  tag: string | null;
};

type BracketMatch = {
  id: string;
  round: number;
  matchNumber: number;
  status: string;
  score1: number;
  score2: number;
  winnerId: string | null;
  team1: Participant | null;
  team2: Participant | null;
  seriesLength: number;
  winsNeeded: number;
  draftComplete: boolean;
};

interface TournamentBracketProps {
  tournamentId: string;
  editable?: boolean;
  format?: string;
}

type DragPayload = {
  teamId: string;
  fromMatchId?: string;
  fromSlot?: "team1" | "team2";
};

export function TournamentBracket({
  tournamentId,
  editable = false,
  format: formatProp = "SINGLE_ELIMINATION",
}: TournamentBracketProps) {
  const t = useTranslations("bracket");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [unassignedIds, setUnassignedIds] = useState<string[]>([]);
  const [format, setFormat] = useState(formatProp);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scoreDraft, setScoreDraft] = useState<Record<string, { score1: number; score2: number }>>({});

  const participantMap = new Map(participants.map((p) => [p.id, p]));
  const bracketSize = getBracketSize(participants.length);

  const bracketRounds = useMemo(
    () => buildWinnersRounds(participants.length, matches),
    [participants.length, matches]
  );

  const losersRounds = useMemo(() => {
    if (format !== "DOUBLE_ELIMINATION") return [];
    return buildLosersRounds(participants.length, matches);
  }, [format, participants.length, matches]);

  const grandFinalRound = useMemo(() => {
    if (format !== "DOUBLE_ELIMINATION") return null;
    return buildGrandFinalRound(matches);
  }, [format, matches]);

  const treeMinHeight = Math.max(
    (bracketRounds[0]?.matches.length ?? 2) * 72,
    280
  );

  const losersTreeMinHeight = useMemo(() => {
    if (losersRounds.length === 0) return treeMinHeight;
    return Math.max((losersRounds[0]?.matches.length ?? 2) * 72, 280);
  }, [losersRounds, treeMinHeight]);

  const applyBracketData = useCallback(
    (data: {
      format?: string;
      participants: Participant[];
      matches: BracketMatch[];
      unassignedIds: string[];
    }) => {
      setParticipants(data.participants);
      setMatches(data.matches);
      setUnassignedIds(data.unassignedIds);
      if (data.format) setFormat(data.format);
    },
    []
  );

  const fetchBracket = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket`);
    if (res.ok) {
      applyBracketData(await res.json());
      setError("");
    } else {
      setError(t("loadFailed"));
    }
    setLoading(false);
  }, [tournamentId, applyBracketData, t]);

  useEffect(() => {
    fetchBracket();
  }, [fetchBracket]);

  async function randomize() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "randomize" }),
    });
    if (res.ok) {
      applyBracketData(await res.json());
      notifyBracketUpdated(tournamentId);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("randomizeFailed"));
    }
    setBusy(false);
  }

  async function initSlots() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "init" }),
    });
    if (res.ok) {
      applyBracketData(await res.json());
      notifyBracketUpdated(tournamentId);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("initFailed"));
    }
    setBusy(false);
  }

  async function assignTeam(
    matchId: string,
    slot: "team1" | "team2",
    teamId: string | null
  ) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tournaments/${tournamentId}/bracket`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, slot, teamId }),
    });
    if (res.ok) {
      applyBracketData(await res.json());
      notifyBracketUpdated(tournamentId);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("updateFailed"));
    }
    setBusy(false);
  }

  async function submitScore(match: BracketDisplayMatch) {
    const draft = scoreDraft[match.id] ?? {
      score1: match.score1,
      score2: match.score2,
    };

    if (!match.draftComplete) {
      setError(t("draftIncomplete"));
      return;
    }

    const seriesCheck = validateSeriesScore(
      draft.score1,
      draft.score2,
      match.seriesLength
    );
    if (!seriesCheck.ok) {
      setError(t(`seriesError.${seriesCheck.reason}`, { winsNeeded: match.winsNeeded }));
      return;
    }

    setBusy(true);
    setError("");
    const res = await fetch(`/api/tournaments/${tournamentId}/matches`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        score1: draft.score1,
        score2: draft.score2,
      }),
    });

    if (res.ok) {
      await fetchBracket();
      notifyBracketUpdated(tournamentId);
      setScoreDraft((prev) => {
        const next = { ...prev };
        delete next[match.id];
        return next;
      });
    } else {
      const data = await res.json().catch(() => ({}));
      if (data.error === "draft_incomplete") {
        setError(t("draftIncomplete"));
      } else if (data.error && typeof data.error === "string") {
        setError(
          t(`seriesError.${data.error}`, {
            winsNeeded: data.winsNeeded ?? match.winsNeeded,
            defaultValue: data.message || t("scoreFailed"),
          })
        );
      } else {
        setError(data.message || t("scoreFailed"));
      }
    }
    setBusy(false);
  }

  function onDragStart(e: React.DragEvent, payload: DragPayload) {
    if (!editable || busy) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function parseDrag(e: React.DragEvent): DragPayload | null {
    try {
      const raw = e.dataTransfer.getData("application/json");
      return raw ? (JSON.parse(raw) as DragPayload) : null;
    } catch {
      return null;
    }
  }

  async function onDropSlot(
    e: React.DragEvent,
    matchId: string,
    slot: "team1" | "team2"
  ) {
    e.preventDefault();
    if (!editable || busy) return;
    const payload = parseDrag(e);
    if (!payload) return;
    await assignTeam(matchId, slot, payload.teamId);
  }

  async function onDropBench(e: React.DragEvent) {
    e.preventDefault();
    if (!editable || busy) return;
    const payload = parseDrag(e);
    if (!payload?.fromMatchId || !payload.fromSlot) return;
    await assignTeam(payload.fromMatchId, payload.fromSlot, null);
  }

  function seedForTeam(teamId: string) {
    const idx = participants.findIndex((p) => p.id === teamId);
    return idx >= 0 ? idx + 1 : null;
  }

  function formatTeamName(team: Participant) {
    const seed = seedForTeam(team.id);
    return seed ? `${seed} ${team.name}` : team.name;
  }

  function lbRoundIndex(match: BracketDisplayMatch) {
    return match.round < 0 ? Math.abs(match.round) : match.round;
  }

  function placeholderLabel(
    match: BracketDisplayMatch,
    slot: "team1" | "team2",
    variant: "winners" | "losers"
  ) {
    if (variant === "losers") {
      const feeders = getLosersFeederMatchNumbers(
        lbRoundIndex(match),
        match.matchNumber,
        bracketSize
      );
      const n = slot === "team1" ? feeders.team1 : feeders.team2;
      return feeders.referLosers
        ? t("loserOfMatch", { n })
        : t("winnerOfMatch", { n });
    }

    const feeders = getFeederMatchNumbers(
      match.round,
      match.matchNumber,
      bracketSize
    );
    if (!feeders) return t("tbd");
    const n = slot === "team1" ? feeders.team1 : feeders.team2;
    return t("winnerOfMatch", { n });
  }

  function matchDisplayNumber(
    match: BracketDisplayMatch,
    variant: "winners" | "losers"
  ) {
    if (variant === "winners" && match.round > 0) {
      return getGlobalMatchNumber(match.round, match.matchNumber, bracketSize);
    }
    if (variant === "losers" && match.round < 0) {
      return match.matchNumber;
    }
    return match.matchNumber;
  }

  function joinBadgeNumber(
    round: { round: number },
    pairIndex: number,
    variant: "winners" | "losers"
  ) {
    if (variant === "winners" && round.round > 0) {
      return getGlobalMatchNumber(round.round + 1, pairIndex + 1, bracketSize);
    }
    return pairIndex + 1;
  }

  function showJoinConnectors(
    variant: "winners" | "losers",
    round: { round: number }
  ) {
    return variant === "losers" || round.round > 0;
  }

  function getScoreDraft(match: BracketDisplayMatch) {
    return scoreDraft[match.id] ?? { score1: match.score1, score2: match.score2 };
  }

  function renderTeamChip(
    participant: Participant,
    dragPayload?: DragPayload
  ) {
    const draggable = editable && !!dragPayload && !busy;
    return (
      <span
        draggable={draggable}
        onDragStart={(e) => dragPayload && onDragStart(e, dragPayload)}
        className={draggable ? "challonge-team-draggable" : undefined}
      >
        {formatTeamName(participant)}
        {participant.tag ? (
          <span className="challonge-team-tag"> [{participant.tag}]</span>
        ) : null}
      </span>
    );
  }

  function renderTeamRow(
    match: BracketDisplayMatch,
    slot: "team1" | "team2",
    team: Participant | null,
    variant: "winners" | "losers"
  ) {
    const isRound1Placement = match.round === 1 && variant === "winners";
    const canDrag =
      editable && !busy && isRound1Placement && match.status !== "completed";
    const isWinner =
      match.status === "completed" &&
      team &&
      match.winnerId === team.id;
    const draft = getScoreDraft(match);
    const scoreValue = slot === "team1" ? draft.score1 : draft.score2;
    const canScore =
      editable &&
      !busy &&
      !match.isPlaceholder &&
      match.status !== "completed" &&
      match.status !== "bye" &&
      !!match.team1 &&
      !!match.team2 &&
      match.draftComplete;

    return (
      <div
        className={`challonge-team-row ${slot === "team2" ? "challonge-team-row-bottom" : ""} ${isWinner ? "challonge-team-winner" : ""}`}
        onDragOver={(e) => canDrag && e.preventDefault()}
        onDrop={(e) => canDrag && onDropSlot(e, match.id, slot)}
      >
        <div className="challonge-team-row-main">
          {team ? (
            renderTeamChip(
              team,
              canDrag ? { teamId: team.id, fromMatchId: match.id, fromSlot: slot } : undefined
            )
          ) : match.isPlaceholder ? (
            <span className="challonge-feeder">
              {placeholderLabel(match, slot, variant)}
            </span>
          ) : canDrag ? (
            <span className="challonge-drop-hint">{t("dropHere")}</span>
          ) : (
            <span className="challonge-feeder">{t("tbd")}</span>
          )}
        </div>
        {(canScore || match.status === "completed") && team && (
          <span className="challonge-team-score">
            {canScore ? (
              <input
                type="number"
                min={0}
                max={match.winsNeeded}
                className="challonge-score-input"
                value={scoreValue}
                onChange={(e) => {
                  const raw = parseInt(e.target.value, 10) || 0;
                  const val = Math.min(
                    match.winsNeeded,
                    Math.max(0, raw)
                  );
                  setScoreDraft((prev) => ({
                    ...prev,
                    [match.id]: {
                      ...getScoreDraft(match),
                      [slot === "team1" ? "score1" : "score2"]: val,
                    },
                  }));
                }}
              />
            ) : (
              scoreValue
            )}
          </span>
        )}
      </div>
    );
  }

  function renderMatchCard(
    match: BracketDisplayMatch,
    variant: "winners" | "losers"
  ) {
    const globalNum = matchDisplayNumber(match, variant);

    const canScore =
      editable &&
      !busy &&
      !match.isPlaceholder &&
      match.status !== "completed" &&
      match.status !== "bye" &&
      !!match.team1 &&
      !!match.team2 &&
      match.draftComplete;

    const awaitingDraft =
      editable &&
      !busy &&
      !match.isPlaceholder &&
      match.status !== "completed" &&
      match.status !== "bye" &&
      !!match.team1 &&
      !!match.team2 &&
      !match.draftComplete;

    return (
      <div
        className={`challonge-match ${match.isPlaceholder ? "challonge-match-placeholder" : ""} ${match.status === "completed" ? "challonge-match-done" : ""}`}
      >
        {!match.isPlaceholder && match.status === "bye" && (
          <span className="challonge-bye">{t("bye")}</span>
        )}
        {!match.isPlaceholder && (
          <span
            className="challonge-match-num"
            title={t("matchLabel", { number: globalNum })}
          >
            {globalNum}
          </span>
        )}
        {!match.isPlaceholder && match.seriesLength > 1 && (
          <span className="challonge-series-label">
            {t("seriesFormat", { format: `BO${match.seriesLength}` })}
          </span>
        )}
        {renderTeamRow(match, "team1", match.team1, variant)}
        {renderTeamRow(match, "team2", match.team2, variant)}
        {awaitingDraft && (
          <p className="challonge-draft-hint">{t("draftIncomplete")}</p>
        )}
        {canScore && (
          <button
            type="button"
            className="challonge-score-btn"
            disabled={busy}
            onClick={() => submitScore(match)}
          >
            {t("confirmScore")}
          </button>
        )}
      </div>
    );
  }

  function renderBracketBoard(
    title: string,
    rounds: ReturnType<typeof buildWinnersRounds>,
    variant: "winners" | "losers" = "winners",
    boardMinHeight = treeMinHeight
  ) {
    return (
      <div className="challonge-board">
        <div className="challonge-board-title">{title}</div>
        <div className="challonge-board-scroll">
          <div
            className="challonge-tree"
            style={{ minHeight: `${boardMinHeight}px` }}
          >
            {rounds.map((round, roundIndex) => {
              const isLastCol = roundIndex === rounds.length - 1;
              const pairs = chunkPairs(round.matches);
              const displayRound =
                variant === "losers" ? Math.abs(round.round) : round.round;

              return (
                <div key={`${variant}-${displayRound}`} className="challonge-col">
                  <div className="challonge-col-title">
                    {round.labelKey === "losersRound" && round.labelParams
                      ? t("losersRound", round.labelParams)
                      : round.labelKey === "grandFinal"
                        ? t("grandFinal")
                        : t(round.labelKey)}
                  </div>
                  <div
                    className="challonge-col-body"
                    style={{ minHeight: `${boardMinHeight - 40}px` }}
                  >
                    {pairs.map((pair, pairIndex) => (
                      <div key={pairIndex} className="challonge-pair">
                        <div className="challonge-pair-matches">
                          {pair.map((match) => (
                            <div key={match.id} className="challonge-match-slot">
                              {renderMatchCard(match, variant)}
                            </div>
                          ))}
                        </div>
                        {!isLastCol &&
                          pair.length > 0 &&
                          showJoinConnectors(variant, round) && (
                            <div className="challonge-join" aria-hidden>
                              <span className="challonge-join-badge">
                                {joinBadgeNumber(round, pairIndex, variant)}
                              </span>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <p className="text-muted text-sm">{t("loading")}</p>;
  }

  if (participants.length < 2) {
    return (
      <div className="card">
        <p className="text-muted text-sm">{t("needParticipants")}</p>
      </div>
    );
  }

  const hasBracket = matches.length > 0;

  return (
    <div className="bracket-panel">
      {editable && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={randomize}
            disabled={busy}
            className="btn btn-primary"
          >
            {busy ? "..." : t("randomize")}
          </button>
          {!hasBracket && (
            <button
              type="button"
              onClick={initSlots}
              disabled={busy}
              className="btn btn-secondary"
            >
              {t("initSlots")}
            </button>
          )}
          {hasBracket && (
            <p className="text-sm text-muted self-center">{t("dragHint")}</p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {!hasBracket ? (
        <div className="card">
          <p className="text-muted text-sm mb-3">{t("noMatchesYet")}</p>
          {!editable && (
            <p className="text-sm text-muted">{t("waitingOrganizer")}</p>
          )}
        </div>
      ) : (
        <>
          {renderBracketBoard(t("winnersBracket"), bracketRounds, "winners")}
          {losersRounds.length > 0 && (
            <div className="mt-6">
              {renderBracketBoard(
                t("losersBracket"),
                losersRounds,
                "losers",
                losersTreeMinHeight
              )}
            </div>
          )}
          {grandFinalRound && (
            <div className="mt-6">
              {renderBracketBoard(t("grandFinal"), [grandFinalRound], "winners")}
            </div>
          )}
        </>
      )}

      {(unassignedIds.length > 0 || editable) && hasBracket && (
        <div
          className="bracket-bench card mt-4"
          onDragOver={(e) => editable && !busy && e.preventDefault()}
          onDrop={onDropBench}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
            {t("unassigned")}
          </h3>
          {unassignedIds.length === 0 ? (
            <p className="text-sm text-muted">{t("allAssigned")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unassignedIds.map((id) => {
                const p = participantMap.get(id);
                if (!p) return null;
                return (
                  <div key={id} className="bracket-team-chip">
                    {renderTeamChip(p, { teamId: p.id })}
                  </div>
                );
              })}
            </div>
          )}
          {editable && (
            <p className="text-xs text-muted mt-2">{t("benchHint")}</p>
          )}
        </div>
      )}
    </div>
  );
}
