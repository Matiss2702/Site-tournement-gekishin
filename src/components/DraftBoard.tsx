"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { HeroCard, type GameRole } from "./HeroCard";
import { BanConfirmBar } from "./BanConfirmBar";
import { DraftPhaseTransition } from "./DraftPhaseTransition";
import {
  countHeroBansByRole,
  countHeroPicksByRole,
  isBanPhaseCompleteForTeams,
  isPickPhaseCompleteForTeams,
  canPickHeroForTeam,
  getBansPerRole,
  getPicksPerRole,
} from "@/lib/draft";
import { getPicksRemainingForActiveTeam } from "@/lib/draft-turn-order";
import { getDraftTeamIds } from "@/lib/draft-access";

interface Hero {
  id: string;
  nameEn: string;
  nameFr: string;
  gameRole: GameRole;
  imageUrl: string | null;
}

interface DraftAction {
  id: string;
  phase: string;
  action: string;
  order: number;
  gameRole: string | null;
  heroName: string | null;
  teamId?: string | null;
  team: { id: string; name: string } | null;
  actor: { id: string; username: string } | null;
}

interface DraftTurn {
  activeTeamId: string | null;
  activeTeamName: string | null;
  phaseActionIndex: number;
  phaseActionTotal: number;
}

interface DraftConfig {
  currentPhase: string;
  currentTurn: number;
  bansPerRole: number;
  heroBansPerTeam: number;
  picksPerTeam: number;
  isActive: boolean;
  draftCompletedAt?: string | null;
  team1Id: string | null;
  team2Id: string | null;
  spectatorToken?: string;
  team1Token?: string;
  team2Token?: string;
  team1?: { id: string; name: string; tag?: string | null } | null;
  team2?: { id: string; name: string; tag?: string | null } | null;
  match?: { id: string; round: number; matchNumber: number; status: string } | null;
}

type Phase = "HERO_BAN" | "HERO_PICK";
export type DraftBoardMode = "organizer" | "captain" | "spectator";

const ROLES: GameRole[] = ["TANK", "SUPPORT", "DPS"];

const roleSectionClass: Record<GameRole, string> = {
  TANK: "draft-role-section-tank",
  SUPPORT: "draft-role-section-support",
  DPS: "draft-role-section-dps",
};

export interface DraftBoardProps {
  tournamentId: string;
  matchId?: string;
  mode?: DraftBoardMode;
  accessToken?: string;
  teamId?: string;
  teamName?: string;
}

export function DraftBoard({
  tournamentId,
  matchId: matchIdProp,
  mode = "spectator",
  accessToken,
  teamId: captainTeamId,
  teamName,
}: DraftBoardProps) {
  const t = useTranslations("draft");
  const tRoles = useTranslations("roles");
  const locale = useLocale();

  const [config, setConfig] = useState<DraftConfig | null>(null);
  const [turn, setTurn] = useState<DraftTurn | null>(null);
  const [actions, setActions] = useState<DraftAction[]>([]);
  const [entries, setEntries] = useState<{ team: { id: string; name: string; tag?: string | null } | null }[]>([]);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [matchId, setMatchId] = useState(matchIdProp ?? "");
  const [loading, setLoading] = useState(false);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [logExpanded, setLogExpanded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [logOverflows, setLogOverflows] = useState(false);

  const readOnly = mode === "spectator" || mode === "organizer";

  const phase = (config?.currentPhase === "HERO_PICK"
    ? "HERO_PICK"
    : "HERO_BAN") as Phase;

  const prevPhaseRef = useRef<Phase>(phase);
  const [showBanToPickTransition, setShowBanToPickTransition] = useState(false);

  useEffect(() => {
    const previous = prevPhaseRef.current;
    if (previous === "HERO_BAN" && phase === "HERO_PICK") {
      setShowBanToPickTransition(true);
      const timer = window.setTimeout(() => setShowBanToPickTransition(false), 3200);
      prevPhaseRef.current = phase;
      return () => window.clearTimeout(timer);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  const fetchDraft = useCallback(async () => {
    const url = accessToken
      ? `/api/tournaments/${tournamentId}/draft/access/${accessToken}`
      : matchIdProp
        ? `/api/tournaments/${tournamentId}/matches/${matchIdProp}/draft`
        : null;

    if (!url) return;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setConfig(data.config);
      setTurn(data.turn ?? null);
      setActions(data.actions);
      if (data.entries) setEntries(data.entries);
      if (data.matchId) setMatchId(data.matchId);
      else if (data.config?.matchId) setMatchId(data.config.matchId);
    }
  }, [tournamentId, accessToken, matchIdProp]);

  useEffect(() => {
    fetchDraft();
    fetch("/api/heroes")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHeroes(data);
      })
      .catch(() => setHeroes([]));
  }, [fetchDraft]);

  useEffect(() => {
    const shouldPoll =
      mode === "captain" || mode === "spectator" || mode === "organizer";

    if (!shouldPoll) return;
    const interval = setInterval(fetchDraft, 3000);
    return () => clearInterval(interval);
  }, [mode, fetchDraft]);

  useEffect(() => {
    const el = logRef.current;
    if (!el || logExpanded) {
      setLogOverflows(false);
      return;
    }
    const check = () => setLogOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [actions, logExpanded]);

  const showLogToggle =
    actions.length >= 5 || logExpanded || logOverflows;

  const heroRoleByName = useMemo(
    () => new Map(heroes.map((h) => [h.nameEn, h.gameRole])),
    [heroes]
  );

  const teamIds = useMemo(
    () => (config ? getDraftTeamIds(config) : []),
    [config]
  );

  const turnActiveTeamId = turn?.activeTeamId ?? null;
  const isMyTurn =
    mode === "captain" &&
    !!captainTeamId &&
    turnActiveTeamId === captainTeamId;

  const quotaTeamId =
    mode === "captain" ? captainTeamId : turnActiveTeamId ?? undefined;

  const banCounts = useMemo(
    () => countHeroBansByRole(actions, heroRoleByName, quotaTeamId),
    [actions, heroRoleByName, quotaTeamId]
  );

  const pickCounts = useMemo(
    () => countHeroPicksByRole(actions, heroRoleByName, quotaTeamId),
    [actions, heroRoleByName, quotaTeamId]
  );

  const teamPickTotal = useMemo(
    () =>
      quotaTeamId
        ? actions.filter((a) => a.action === "PICK" && a.teamId === quotaTeamId).length
        : actions.filter((a) => a.action === "PICK").length,
    [actions, quotaTeamId]
  );

  const picksRemainingThisTurn = useMemo(() => {
    if (!config?.team1Id || !config.team2Id || phase !== "HERO_PICK") return 1;
    return getPicksRemainingForActiveTeam(
      phase,
      actions,
      config.team1Id,
      config.team2Id
    );
  }, [actions, config?.team1Id, config?.team2Id, phase]);

  async function submitAction(hero: Hero, actionType: "BAN" | "PICK") {
    setLoading(true);
    const url = accessToken
      ? `/api/tournaments/${tournamentId}/draft/access/${accessToken}`
      : `/api/tournaments/${tournamentId}/draft`;

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: actionType,
        phase: actionType === "BAN" ? "HERO_BAN" : "HERO_PICK",
        heroName: hero.nameEn,
        teamId: captainTeamId,
      }),
    });

    setSelectedHero(null);
    await fetchDraft();
    setLoading(false);
  }

  function heroName(hero: Hero) {
    return locale === "fr" ? hero.nameFr : hero.nameEn;
  }

  const bannedHeroNames = new Set(
    actions
      .filter((a) => a.action === "BAN" && a.heroName)
      .map((a) => a.heroName!)
  );

  const pickedHeroMap = new Map<string, string>();
  for (const action of actions) {
    if (action.action === "PICK" && action.heroName) {
      pickedHeroMap.set(
        action.heroName,
        action.team?.name ?? t("picked")
      );
    }
  }

  const banPhaseDone = isBanPhaseCompleteForTeams(
    actions,
    heroRoleByName,
    teamIds
  );

  const draftComplete = useMemo(() => {
    if (!config) return false;
    if (config.draftCompletedAt) return true;
    if (config.isActive) return false;
    if (teamIds.length === 0 || actions.length === 0) return false;
    return isPickPhaseCompleteForTeams(actions, heroRoleByName, teamIds);
  }, [config, teamIds, actions, heroRoleByName]);

  const draftNotStarted = !!config && !config.isActive && !draftComplete;

  function canActThisTurn() {
    return mode === "captain" && isMyTurn && config?.isActive;
  }

  function canBanHero(hero: Hero) {
    if (!canActThisTurn()) return false;
    if (bannedHeroNames.has(hero.nameEn) || pickedHeroMap.has(hero.nameEn)) {
      return false;
    }
    return banCounts[hero.gameRole] < getBansPerRole(hero.gameRole);
  }

  function canPickHero(hero: Hero) {
    if (!canActThisTurn()) return false;
    if (bannedHeroNames.has(hero.nameEn) || pickedHeroMap.has(hero.nameEn)) {
      return false;
    }
    return canPickHeroForTeam(hero.gameRole, pickCounts, teamPickTotal);
  }

  function handleHeroClick(hero: Hero, actionMode: "ban" | "pick") {
    if (readOnly || loading) return;
    const available =
      actionMode === "ban" ? canBanHero(hero) : canPickHero(hero);
    if (!available) return;

    setSelectedHero(hero);
  }

  function renderHeroCard(hero: Hero, actionMode: "ban" | "pick") {
    const nameEn = hero.nameEn;
    const isBanned = bannedHeroNames.has(nameEn);
    const isPicked = pickedHeroMap.has(nameEn);
    const isAvailable =
      actionMode === "ban" ? canBanHero(hero) : canPickHero(hero);

    let state: "available" | "banned" | "picked" | "disabled" = "available";
    if (isBanned) state = "banned";
    else if (isPicked) state = "picked";
    else if (!isAvailable) state = "disabled";

    const isSelected = selectedHero?.id === hero.id;

    return (
      <HeroCard
        key={hero.id}
        name={heroName(hero)}
        role={hero.gameRole}
        roleLabel={tRoles(hero.gameRole)}
        imageUrl={hero.imageUrl}
        state={state}
        teamName={pickedHeroMap.get(nameEn)}
        selected={isSelected}
        onClick={
          !readOnly && isAvailable
            ? () => handleHeroClick(hero, actionMode)
            : undefined
        }
      />
    );
  }

  function renderRoleSections(actionMode: "ban" | "pick", preview = false) {
    return ROLES.map((role) => {
      const roleHeroes = heroes.filter((h) => h.gameRole === role);
      const isBan = actionMode === "ban";
      const count = isBan ? banCounts[role] : pickCounts[role];
      const quotaTotal = isBan ? getBansPerRole(role) : getPicksPerRole(role);
      const quotaFull = count >= quotaTotal;

      let hint: string;
      if (preview) {
        hint = t("previewRoleHint");
      } else if (readOnly) {
        hint =
          !isBan && mode === "organizer"
            ? t("pickPhaseOrganizerHint")
            : t("spectatorHint");
      } else if (!isMyTurn) {
        hint = t("waitYourTurn");
      } else if (quotaFull) {
        hint = isBan ? t("roleBanComplete") : t("rolePickComplete");
      } else {
        hint = isBan ? t("clickToBanRole") : t("clickToPickRole");
      }

      return (
        <section key={role} className={`draft-role-section ${roleSectionClass[role]}`}>
          <div className="draft-role-section-header">
            <h3 className="draft-role-section-title">{tRoles(role)}</h3>
            {!preview && (
              <span className={`draft-role-quota ${quotaFull ? "draft-role-quota-full" : ""}`}>
                {isBan
                  ? t("bansCount", { count, total: quotaTotal })
                  : t("picksCount", { count, total: quotaTotal })}
              </span>
            )}
          </div>
          <p className="draft-role-section-hint text-sm text-muted mb-3">{hint}</p>
          <div className="hero-card-grid">
            {roleHeroes.map((hero) =>
              preview ? (
                <HeroCard
                  key={hero.id}
                  name={heroName(hero)}
                  role={hero.gameRole}
                  roleLabel={tRoles(hero.gameRole)}
                  imageUrl={hero.imageUrl}
                  state="disabled"
                />
              ) : (
                renderHeroCard(hero, actionMode)
              )
            )}
          </div>
        </section>
      );
    });
  }

  const phaseLabel = phase === "HERO_BAN" ? t("heroBan") : t("heroPick");

  return (
    <div className="space-y-6 draft-board-root">
      <DraftPhaseTransition active={showBanToPickTransition} />
      {mode === "captain" && teamName && (
        <div className="draft-arena">
          <p className="text-sm font-semibold text-sky-400 uppercase tracking-wider">
            {t("captainView")} — {teamName}
          </p>
          {config?.team1 && config?.team2 && (
            <p className="text-sm text-muted mt-2">
              {t("matchup", {
                team1: config.team1.name,
                team2: config.team2.name,
              })}
            </p>
          )}
          <p className="text-sm text-muted mt-1">
            {phase === "HERO_PICK" ? t("captainPickHint") : t("captainViewHint")}
          </p>
          {config?.isActive && turnActiveTeamId && (
            <p className={`text-sm mt-2 font-semibold ${isMyTurn ? "text-green-400" : "text-amber-400"}`}>
              {isMyTurn
                ? phase === "HERO_PICK" && picksRemainingThisTurn > 1
                  ? t("yourTurnMultiPick", { count: picksRemainingThisTurn })
                  : t("yourTurn")
                : t("waitingOpponentTurn", { team: turn?.activeTeamName ?? "…" })}
            </p>
          )}
        </div>
      )}

      {(mode === "spectator" || mode === "organizer") && (
        <div className="draft-arena">
          <p className="text-sm font-semibold text-muted uppercase tracking-wider">
            {t("spectatorView")} — {t("readOnly")}
          </p>
          {config?.team1 && config?.team2 && (
            <p className="text-sm text-muted mt-2">
              {t("matchup", {
                team1: config.team1.name,
                team2: config.team2.name,
              })}
            </p>
          )}
        </div>
      )}

      {(mode === "captain" || mode === "spectator" || mode === "organizer") &&
        draftNotStarted && (
          <div className="draft-arena">
            <p className="text-sm text-amber-400 mb-4">{t("waitingForStart")}</p>
            {heroes.length > 0 ? (
              <>
                <p className="text-sm text-muted mb-4">{t("previewHint")}</p>
                {renderRoleSections("ban", true)}
              </>
            ) : (
              <p className="text-sm text-muted">{t("loadingHeroes")}</p>
            )}
          </div>
        )}

      {draftComplete && !config?.isActive && (
        <div className="draft-arena">
          <p className="text-sm text-green-400 font-semibold">{t("draftComplete")}</p>
          {config?.match?.status === "completed" && (
            <p className="text-sm text-muted mt-1">{t("matchComplete")}</p>
          )}
        </div>
      )}

      {config?.isActive && (
        <div
          className={`draft-arena draft-arena--active ${
            phase === "HERO_PICK" ? "draft-arena--pick-phase" : "draft-arena--ban-phase"
          } ${showBanToPickTransition ? "draft-arena--phase-transitioning" : ""}`}
        >
          <div className="draft-phase-bar">
            <span
              className={`draft-phase-indicator ${
                phase === "HERO_PICK" ? "draft-phase-indicator--pick" : "draft-phase-indicator--ban"
              }`}
            >
              {phaseLabel}
            </span>
            {turn?.activeTeamName && (
              <span className="draft-phase-indicator draft-phase-turn">
                {t("activeTeamTurn", { team: turn.activeTeamName })}
              </span>
            )}
            <span className="draft-phase-indicator draft-phase-step">
              {t("draftStep", {
                current: (turn?.phaseActionIndex ?? 0) + 1,
                total: turn?.phaseActionTotal ?? 8,
              })}
            </span>
            {phase === "HERO_BAN" && (
              <span className="text-sm text-muted">{t("banPhaseHint")}</span>
            )}
            {phase === "HERO_PICK" && (
              <span className="text-sm text-muted">{t("pickPhaseHint")}</span>
            )}
          </div>

          {renderRoleSections(phase === "HERO_BAN" ? "ban" : "pick")}

          {phase === "HERO_PICK" && banPhaseDone && mode !== "organizer" && !showBanToPickTransition && (
            <p className="mt-4 text-sm text-emerald-400 font-semibold draft-pick-phase-hint">
              {t("pickPhaseStarted")}
            </p>
          )}
        </div>
      )}

      {selectedHero && mode === "captain" && (
        <BanConfirmBar
          heroName={heroName(selectedHero)}
          role={selectedHero.gameRole}
          roleLabel={tRoles(selectedHero.gameRole)}
          imageUrl={selectedHero.imageUrl}
          confirmLabel={
            phase === "HERO_PICK" ? t("confirmPick") : t("confirmBan")
          }
          cancelLabel={
            phase === "HERO_PICK" ? t("cancelPick") : t("cancelBan")
          }
          loading={loading}
          onConfirm={() =>
            submitAction(selectedHero, phase === "HERO_PICK" ? "PICK" : "BAN")
          }
          onCancel={() => setSelectedHero(null)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="draft-arena">
          <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-red-400">
            {t("bannedHeroes")}
          </h3>
          {bannedHeroNames.size === 0 ? (
            <p className="text-muted text-sm">—</p>
          ) : (
            <div className="hero-card-grid">
              {heroes
                .filter((h) => bannedHeroNames.has(h.nameEn))
                .map((hero) => (
                  <HeroCard
                    key={hero.id}
                    name={heroName(hero)}
                    role={hero.gameRole}
                    roleLabel={tRoles(hero.gameRole)}
                    imageUrl={hero.imageUrl}
                    state="banned"
                  />
                ))}
            </div>
          )}
        </div>

        <div className="draft-arena">
          <h3 className="font-bold mb-3 text-sm uppercase tracking-wider text-green-400">
            {t("pickedHeroes")}
          </h3>
          {pickedHeroMap.size === 0 ? (
            <p className="text-muted text-sm">—</p>
          ) : (
            <div className="hero-card-grid">
              {heroes
                .filter((h) => pickedHeroMap.has(h.nameEn))
                .map((hero) => (
                  <HeroCard
                    key={hero.id}
                    name={heroName(hero)}
                    role={hero.gameRole}
                    roleLabel={tRoles(hero.gameRole)}
                    imageUrl={hero.imageUrl}
                    state="picked"
                    teamName={pickedHeroMap.get(hero.nameEn)}
                  />
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="draft-arena">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="font-bold text-sm uppercase tracking-wider text-sky-400">
            {t("draftLog")}
            {actions.length > 0 && (
              <span className="ml-2 font-normal normal-case text-muted">
                ({actions.length})
              </span>
            )}
          </h3>
          {showLogToggle && (
            <button
              type="button"
              onClick={() => setLogExpanded((v) => !v)}
              className="text-xs text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
            >
              {logExpanded ? t("collapseLog") : t("showFullLog")}
            </button>
          )}
        </div>
        <div
          ref={logRef}
          className={`draft-log${logExpanded ? " draft-log-expanded" : ""}${logOverflows && !logExpanded ? " draft-log-scrollable" : ""}`}
        >
          {actions.length === 0 ? (
            <p className="text-muted text-sm">—</p>
          ) : (
            actions.map((action) => (
              <div key={action.id} className="draft-log-entry">
                <span className="text-muted font-mono">#{action.order}</span>
                <span
                  className={
                    action.action === "BAN"
                      ? "text-red-400 font-bold"
                      : "text-green-400 font-bold"
                  }
                >
                  {action.action}
                </span>
                {action.gameRole && (
                  <span className={`badge badge-${action.gameRole.toLowerCase()}`}>
                    {tRoles(action.gameRole as GameRole)}
                  </span>
                )}
                {action.heroName && (
                  <span>
                    {heroes.find((h) => h.nameEn === action.heroName)
                      ? heroName(heroes.find((h) => h.nameEn === action.heroName)!)
                      : action.heroName}
                  </span>
                )}
                {action.team && (
                  <span className="text-muted">({action.team.name})</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
