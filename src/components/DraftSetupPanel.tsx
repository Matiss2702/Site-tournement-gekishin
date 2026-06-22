"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";

interface TeamOption {
  id: string;
  name: string;
  tag?: string | null;
}

interface DraftConfig {
  team1Id: string | null;
  team2Id: string | null;
  isActive?: boolean;
  spectatorToken?: string;
  team1Token?: string;
  team2Token?: string;
  team1?: TeamOption | null;
  team2?: TeamOption | null;
}

interface DraftSetupPanelProps {
  tournamentId: string;
  config: DraftConfig | null;
  entries: { team: TeamOption | null }[];
  onUpdated: () => void;
}

export function DraftSetupPanel({
  tournamentId,
  config,
  entries,
  onUpdated,
}: DraftSetupPanelProps) {
  const t = useTranslations("draft");
  const locale = useLocale();
  const [team1Id, setTeam1Id] = useState(config?.team1Id ?? "");
  const [team2Id, setTeam2Id] = useState(config?.team2Id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resolvedTeam1 = config?.team1Id || team1Id;
  const resolvedTeam2 = config?.team2Id || team2Id;

  const teams = entries
    .map((e) => e.team)
    .filter((team): team is TeamOption => !!team);

  async function saveTeams() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/tournaments/${tournamentId}/draft`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team1Id: resolvedTeam1 || null,
        team2Id: resolvedTeam2 || null,
      }),
    });
    if (res.ok) {
      onUpdated();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(
        res.status === 403
          ? t("forbidden")
          : data.error || t("saveTeamsFailed")
      );
    }
    setSaving(false);
  }

  function buildLink(path: string) {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}/${locale}${path}`;
  }

  function copyLink(path: string) {
    navigator.clipboard.writeText(buildLink(path));
  }

  if (!config) return null;

  const teamsLocked = config.isActive === true;

  return (
    <div className="draft-arena mb-6">
      <h3 className="font-bold mb-4 text-sm uppercase tracking-wider text-sky-400">
        {t("setupTitle")}
      </h3>

      {config.team1 && config.team2 && (
        <p className="text-sm text-muted mb-4">
          {t("matchup", {
            team1: `${config.team1.name}${config.team1.tag ? ` [${config.team1.tag}]` : ""}`,
            team2: `${config.team2.name}${config.team2.tag ? ` [${config.team2.tag}]` : ""}`,
          })}
        </p>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={resolvedTeam1}
          onChange={(e) => setTeam1Id(e.target.value)}
          disabled={teamsLocked}
        >
          <option value="">{t("selectTeam1")}</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
              {team.tag ? ` [${team.tag}]` : ""}
            </option>
          ))}
        </select>
        <select
          value={resolvedTeam2}
          onChange={(e) => setTeam2Id(e.target.value)}
          disabled={teamsLocked}
        >
          <option value="">{t("selectTeam2")}</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id} disabled={team.id === resolvedTeam1}>
              {team.name}
              {team.tag ? ` [${team.tag}]` : ""}
            </option>
          ))}
        </select>
        {!teamsLocked && (
          <button
            type="button"
            onClick={saveTeams}
            disabled={saving}
            className="btn btn-primary"
          >
            {t("saveTeams")}
          </button>
        )}
      </div>

      {teamsLocked && (
        <p className="text-xs text-muted mb-4">{t("teamsLocked")}</p>
      )}

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="space-y-3">
        <DraftLinkRow
          label={t("spectatorLink")}
          hint={t("spectatorLinkHint")}
          url={buildLink(
            `/tournaments/${tournamentId}/draft/watch/${config.spectatorToken ?? ""}`
          )}
          onCopy={() =>
            copyLink(`/tournaments/${tournamentId}/draft/watch/${config.spectatorToken ?? ""}`)
          }
        />
        {config.team1Id && config.team1Token && (
          <DraftLinkRow
            label={t("captainLink", {
              team: config.team1?.name ?? t("team1"),
            })}
            hint={t("captainLinkHint")}
            url={buildLink(
              `/tournaments/${tournamentId}/draft/captain/${config.team1Token}`
            )}
            onCopy={() =>
              copyLink(
                `/tournaments/${tournamentId}/draft/captain/${config.team1Token}`
              )
            }
          />
        )}
        {config.team2Id && config.team2Token && (
          <DraftLinkRow
            label={t("captainLink", {
              team: config.team2?.name ?? t("team2"),
            })}
            hint={t("captainLinkHint")}
            url={buildLink(
              `/tournaments/${tournamentId}/draft/captain/${config.team2Token}`
            )}
            onCopy={() =>
              copyLink(
                `/tournaments/${tournamentId}/draft/captain/${config.team2Token}`
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function DraftLinkRow({
  label,
  hint,
  url,
  onCopy,
}: {
  label: string;
  hint: string;
  url: string;
  onCopy: () => void;
}) {
  const t = useTranslations("draft");

  return (
    <div className="draft-link-row">
      <div>
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <code className="draft-link-url">{url}</code>
      <button type="button" onClick={onCopy} className="btn btn-secondary text-sm">
        {t("copyLink")}
      </button>
    </div>
  );
}
