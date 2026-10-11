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
import {
  BANDAI_SUPPORT_TERMS_URL,
  requiresBandaiConsent,
} from "@/lib/bandai-support";

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
  startDateReached?: boolean;
  startDateLabel?: string | null;
  bandaiSupportStatus?: string;
  needsBandaiConsent?: boolean;
  isPlatformAdmin?: boolean;
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
  startDateReached = false,
  startDateLabel = null,
  bandaiSupportStatus = "NONE",
  needsBandaiConsent = false,
  isPlatformAdmin = false,
}: TournamentActionsProps) {
  const t = useTranslations("tournaments");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const bandaiConsentRequired = requiresBandaiConsent(bandaiSupportStatus);
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
  const soloRemainder = entryCount % SOLO_TEAM_SIZE;
  const checkInBlockedHint = canStartCheckIn
    ? null
    : type === "SOLO"
      ? entryCount >= MIN_SOLO_PLAYERS && soloRemainder !== 0
        ? t("soloPlayerCountNotMultiple", {
            teamSize: SOLO_TEAM_SIZE,
            current: entryCount,
            remove: soloRemainder,
            add: SOLO_TEAM_SIZE - soloRemainder,
          })
        : t("soloMinParticipantsHint", {
            required: MIN_SOLO_PLAYERS,
            teams: MIN_TOURNAMENT_PARTICIPANTS,
            current: entryCount,
            teamSize: SOLO_TEAM_SIZE,
          })
      : t("minParticipantsHint", {
          required: MIN_TOURNAMENT_PARTICIPANTS,
          current: entryCount,
        });

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

    if (bandaiConsentRequired && (!adultConfirmed || !rulesAccepted)) {
      setMessage(
        !adultConfirmed ? t("adultConfirmationRequired") : t("rulesAcceptanceRequired")
      );
      setLoading(false);
      return;
    }

    const body: {
      action: string;
      teamId?: string;
      adultConfirmed?: boolean;
      rulesAccepted?: boolean;
    } = { action: "join" };
    if (bandaiConsentRequired) {
      body.adultConfirmed = true;
      body.rulesAccepted = true;
    }
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
              : data.error === "adult_confirmation_required"
                ? t("adultConfirmationRequired")
                : data.error === "rules_acceptance_required"
                  ? t("rulesAcceptanceRequired")
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

  async function handleConfirmBandai() {
    if (!adultConfirmed || !rulesAccepted) {
      setMessage(
        !adultConfirmed ? t("adultConfirmationRequired") : t("rulesAcceptanceRequired")
      );
      return;
    }
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm_bandai",
        adultConfirmed: true,
        rulesAccepted: true,
      }),
    });
    if (res.ok) {
      setAdultConfirmed(false);
      setRulesAccepted(false);
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(
        data.error === "adult_confirmation_required"
          ? t("adultConfirmationRequired")
          : data.error === "rules_acceptance_required"
            ? t("rulesAcceptanceRequired")
            : t("bandaiConsentFailed")
      );
    }
    setLoading(false);
  }

  async function handleBandaiStatus(nextStatus: string) {
    setLoading(true);
    setMessage("");
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_bandai_support", status: nextStatus }),
    });
    if (!res.ok) {
      setMessage(t("bandaiStatusForbidden"));
    } else {
      router.refresh();
    }
    setLoading(false);
  }

  function bandaiConsentFields() {
    if (!bandaiConsentRequired) return null;
    return (
      <div className="w-full space-y-3 rounded-lg border border-card-border p-4">
        <p className="text-sm text-muted">{t("bandaiConsentIntro")}</p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={adultConfirmed}
            onChange={(e) => setAdultConfirmed(e.target.checked)}
          />
          <span>{t("adultConfirmationLabel")}</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={rulesAccepted}
            onChange={(e) => setRulesAccepted(e.target.checked)}
          />
          <span>
            {t("rulesAcceptanceLabel")}{" "}
            <a
              href={BANDAI_SUPPORT_TERMS_URL}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {t("bandaiTermsLink")}
            </a>
            {" · "}
            <a href="#tournament-rules" className="underline">
              {t("rulesTitle")}
            </a>
          </span>
        </label>
      </div>
    );
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
            {isLoggedIn && bandaiConsentFields()}
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

        {needsBandaiConsent && (
          <div className="w-full space-y-3">
            <p className="text-sm text-amber-300">{t("bandaiConsentPending")}</p>
            {bandaiConsentFields()}
            <button
              type="button"
              onClick={handleConfirmBandai}
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "..." : t("confirmBandaiConsent")}
            </button>
          </div>
        )}

        {status === "REGISTRATION" && alreadyJoined && !isOrganizer && !needsBandaiConsent && (
          <span className="badge bg-primary/20 text-primary">{t("joined")}</span>
        )}

        {isOrganizer && status === "DRAFT" && (
          <button
            type="button"
            onClick={() => handleStatusChange("REGISTRATION")}
            disabled={loading}
            className="btn btn-primary"
          >
            {t("openRegistration")}
          </button>
        )}

        {isOrganizer && bandaiSupportStatus === "NONE" && (
          <button
            type="button"
            onClick={() => handleBandaiStatus("PENDING")}
            disabled={loading}
            className="btn btn-secondary"
          >
            {t("markBandaiPending")}
          </button>
        )}
        {isOrganizer && bandaiSupportStatus === "PENDING" && (
          <button
            type="button"
            onClick={() => handleBandaiStatus("NONE")}
            disabled={loading}
            className="btn btn-secondary"
          >
            {t("withdrawBandaiRequest")}
          </button>
        )}
        {isPlatformAdmin && bandaiSupportStatus !== "APPROVED" && (
          <button
            type="button"
            onClick={() => handleBandaiStatus("APPROVED")}
            disabled={loading}
            className="btn btn-secondary"
          >
            {t("markBandaiApproved")}
          </button>
        )}
        {isPlatformAdmin &&
          bandaiSupportStatus !== "REJECTED" &&
          bandaiSupportStatus !== "NONE" && (
            <button
              type="button"
              onClick={() => handleBandaiStatus("REJECTED")}
              disabled={loading}
              className="btn btn-secondary"
            >
              {t("markBandaiRejected")}
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
            {checkInBlockedHint && (
              <p className="text-sm text-amber-400 w-full">
                {checkInBlockedHint}
              </p>
            )}
            {!startDateReached && (
              <p className="text-sm text-amber-400 w-full">
                {startDateLabel
                  ? t("tooEarlyToStart", { date: startDateLabel })
                  : t("startDateMissing")}
              </p>
            )}
            <button
              onClick={handleStartCheckIn}
              disabled={loading || !canStartCheckIn || !startDateReached}
              className="btn btn-primary"
              title={checkInBlockedHint ?? undefined}
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
