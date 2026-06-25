"use client";

import { useState, useEffect } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  MIN_SOLO_PLAYERS,
  MIN_TOURNAMENT_PARTICIPANTS,
  isValidSoloPlayerCount,
  SOLO_TEAM_SIZE,
} from "@/lib/tournament-prize-config";

interface TeamOption {
  id: string;
  name: string;
  tag: string | null;
  memberCount?: number;
}

type RegistrationConflict = {
  username: string;
  otherTeamName: string;
  otherTeamTag: string | null;
};

function formatMemberConflictMessage(
  conflicts: RegistrationConflict[] | undefined,
  t: (key: string, values?: Record<string, string>) => string
) {
  if (!conflicts?.length) return t("memberConflict");
  const first = conflicts[0];
  const otherTeam = `${first.otherTeamName}${
    first.otherTeamTag ? ` [${first.otherTeamTag}]` : ""
  }`;
  return t("memberConflictDetail", {
    username: first.username,
    team: otherTeam,
  });
}

interface TournamentActionsProps {
  tournamentId: string;
  status: string;
  type: string;
  isOrganizer: boolean;
  isLoggedIn: boolean;
  availableTeams?: TeamOption[];
  alreadyJoined?: boolean;
  preferredTeamId?: string;
  registrationFull?: boolean;
  teamTooSmallForTournament?: boolean;
  memberConflictBlocksJoin?: boolean;
  minTeamRosterSize?: number;
  entryCount?: number;
}

export function TournamentActions({
  tournamentId,
  status,
  type,
  isOrganizer,
  isLoggedIn,
  availableTeams = [],
  alreadyJoined = false,
  preferredTeamId,
  registrationFull = false,
  teamTooSmallForTournament = false,
  memberConflictBlocksJoin = false,
  minTeamRosterSize = 4,
  entryCount = 0,
}: TournamentActionsProps) {
  const t = useTranslations("tournaments");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const initialTeamId =
    preferredTeamId && availableTeams.some((team) => team.id === preferredTeamId)
      ? preferredTeamId
      : availableTeams.length === 1
        ? availableTeams[0].id
        : availableTeams[0]?.id ?? "";
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId);
  const [message, setMessage] = useState("");
  const canStartCheckIn =
    type === "SOLO"
      ? isValidSoloPlayerCount(entryCount)
      : entryCount >= MIN_TOURNAMENT_PARTICIPANTS;

  useEffect(() => {
    const preferred =
      preferredTeamId && availableTeams.some((team) => team.id === preferredTeamId)
        ? preferredTeamId
        : availableTeams.length === 1
          ? availableTeams[0].id
          : null;

    if (preferred && preferred !== selectedTeamId) {
      setSelectedTeamId(preferred);
      return;
    }

    if (
      availableTeams.length > 0 &&
      !availableTeams.some((team) => team.id === selectedTeamId)
    ) {
      setSelectedTeamId(availableTeams[0].id);
    }
  }, [availableTeams, preferredTeamId, selectedTeamId]);

  async function handleJoin() {
    setLoading(true);
    setMessage("");

    const body: { action: string; teamId?: string } = { action: "join" };
    if (type === "TEAM") {
      if (!selectedTeamId) {
        setMessage(t("joinSelectTeam"));
        setLoading(false);
        return;
      }
      body.teamId = selectedTeamId;
    }

    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(
        data.error === "Tournament full"
          ? t("registrationFull")
          : data.error === "team_too_small"
            ? t("teamTooSmall", {
                count: data.memberCount ?? 0,
                required: data.required ?? minTeamRosterSize,
              })
            : data.error === "member_conflict"
              ? formatMemberConflictMessage(data.conflicts, t)
              : data.error || t("joinFailed")
      );
    }
    setLoading(false);
  }

  async function handleStatusChange(newStatus: string) {
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(
        data.error === "check_in_incomplete"
          ? t("checkInIncomplete")
          : data.error === "check_in_required"
            ? t("checkInRequired")
            : data.error === "reopen_has_entries"
              ? t("reopenHasEntries")
              : data.error === "reopen_has_results"
                ? t("reopenHasResults")
                : t("startTournamentFailed")
      );
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  async function handleStartCheckIn() {
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start_check_in" }),
    });
    if (!res.ok) {
      const data = await res.json();
      setMessage(
        data.error === "no_entries"
          ? t("checkInNoEntries")
          : data.error === "min_participants"
            ? t("minParticipantsRequired", {
                required: data.required ?? MIN_TOURNAMENT_PARTICIPANTS,
                current: data.current ?? entryCount,
              })
          : data.error === "solo_team_size_mismatch"
            ? t("soloTeamSizeMismatch", {
                minPlayers: data.minPlayers ?? MIN_SOLO_PLAYERS,
                teams: MIN_TOURNAMENT_PARTICIPANTS,
                teamSize: data.teamSize ?? SOLO_TEAM_SIZE,
                current: data.current ?? entryCount,
              })
          : data.error === "invalid_status"
            ? t("checkInInvalidStatus")
            : t("checkInFailed")
      );
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!window.confirm(t("deleteConfirm"))) return;

    setLoading(true);
    setMessage("");

    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.push("/tournaments");
      return;
    }

    setMessage(t("deleteFailed"));
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap items-center">
        {status !== "REGISTRATION" &&
          !isOrganizer &&
          !alreadyJoined &&
          isLoggedIn && (
            <p className="text-sm text-muted w-full">{t("registrationClosed")}</p>
          )}

        {status === "REGISTRATION" && !isOrganizer && !alreadyJoined && registrationFull && (
          <span className="badge bg-card-border text-muted">{t("registrationFull")}</span>
        )}

        {status === "REGISTRATION" && !isOrganizer && !alreadyJoined && !registrationFull && (
          <>
            {type === "SOLO" && isLoggedIn && (
              <p className="text-sm text-muted w-full">{t("soloRegisterHint")}</p>
            )}
            {!isLoggedIn ? (
              <Link href="/login" className="btn btn-primary">
                {t("joinLogin")}
              </Link>
            ) : type === "TEAM" ? (
              availableTeams.length > 0 ? (
                <>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="!w-auto min-w-[180px]"
                  >
                    {availableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                        {team.tag ? ` [${team.tag}]` : ""}
                        {team.memberCount != null
                          ? ` (${team.memberCount})`
                          : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleJoin}
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? "..." : t("joinWithTeam")}
                  </button>
                </>
              ) : teamTooSmallForTournament ? (
                <p className="text-sm text-amber-400">
                  {t("teamTooSmallHint", { count: minTeamRosterSize })}
                </p>
              ) : memberConflictBlocksJoin ? (
                <p className="text-sm text-amber-400">{t("memberConflictHint")}</p>
              ) : (
                <Link href="/teams/create" className="btn btn-primary">
                  {t("joinCreateTeam")}
                </Link>
              )
            ) : (
              <button
                onClick={handleJoin}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? "..." : t("join")}
              </button>
            )}
          </>
        )}

        {status === "REGISTRATION" && alreadyJoined && !isOrganizer && (
          <span className="badge bg-primary/20 text-primary">{t("joined")}</span>
        )}

        {status === "CHECK_IN" && alreadyJoined && !isOrganizer && (
          <span className="badge bg-amber-500/15 text-amber-300">{t("checkInPhase")}</span>
        )}

        {isOrganizer && status === "DRAFT" && (
          <button
            onClick={() => handleStatusChange("REGISTRATION")}
            disabled={loading}
            className="btn btn-primary"
          >
            {t("openRegistration")}
          </button>
        )}

        {isOrganizer &&
          status !== "REGISTRATION" &&
          status !== "COMPLETED" &&
          status !== "DRAFT" &&
          entryCount === 0 && (
            <button
              onClick={() => handleStatusChange("REGISTRATION")}
              disabled={loading}
              className="btn btn-primary"
            >
              {t("reopenRegistration")}
            </button>
          )}

        {isOrganizer && status === "REGISTRATION" && (
          <>
            {!canStartCheckIn && (
              <p className="text-sm text-amber-400 w-full">
                {type === "SOLO"
                  ? t("soloMinParticipantsHint", {
                      required: MIN_SOLO_PLAYERS,
                      teams: MIN_TOURNAMENT_PARTICIPANTS,
                      current: entryCount,
                      teamSize: SOLO_TEAM_SIZE,
                    })
                  : t("minParticipantsHint", {
                      required: MIN_TOURNAMENT_PARTICIPANTS,
                      current: entryCount,
                    })}
              </p>
            )}
            <button
              onClick={handleStartCheckIn}
              disabled={loading || !canStartCheckIn}
              className="btn btn-primary"
              title={
                !canStartCheckIn
                  ? type === "SOLO"
                    ? t("minParticipantsRequired", {
                        required: MIN_SOLO_PLAYERS,
                        current: entryCount,
                      })
                    : t("minParticipantsRequired", {
                        required: MIN_TOURNAMENT_PARTICIPANTS,
                        current: entryCount,
                      })
                  : undefined
              }
            >
              {loading ? "..." : t("startCheckIn")}
            </button>
          </>
        )}

        {isOrganizer && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="btn btn-danger"
          >
            {t("deleteTournament")}
          </button>
        )}
      </div>

      {message && <p className="text-sm text-red-400">{message}</p>}
    </div>
  );
}
