"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export type CheckInEntry = {
  id: string;
  name: string;
  tag: string | null;
  isCheckedIn: boolean;
};

interface TournamentCheckInPanelProps {
  tournamentId: string;
  entries: CheckInEntry[];
  checkedIn: number;
  total: number;
  minParticipants: number;
  allCheckedIn: boolean;
  canConfirmCheckIn: boolean;
  hasConfirmedCheckIn: boolean;
  waitingForCaptainCheckIn: boolean;
  teamCheckInConfirmed: boolean;
  isOrganizer: boolean;
}

export function TournamentCheckInPanel({
  tournamentId,
  entries,
  checkedIn,
  total,
  minParticipants,
  allCheckedIn,
  canConfirmCheckIn,
  hasConfirmedCheckIn,
  waitingForCaptainCheckIn,
  teamCheckInConfirmed,
  isOrganizer,
}: TournamentCheckInPanelProps) {
  const t = useTranslations("tournaments");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleConfirmCheckIn() {
    setLoading(true);
    setMessage("");

    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_check_in" }),
    });

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(
        data.error === "check_in_closed"
          ? t("checkInClosed")
          : data.error === "not_participant"
            ? t("checkInNotParticipant")
            : t("checkInFailed")
      );
    }
    setLoading(false);
  }

  async function handleStartTournament() {
    setLoading(true);
    setMessage("");

    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    });

    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      setMessage(
        data.error === "check_in_incomplete"
          ? t("checkInIncomplete")
          : data.error === "min_participants"
            ? t("minParticipantsRequired", {
                required: data.required ?? minParticipants,
                current: data.current ?? total,
              })
            : data.error === "check_in_required"
              ? t("checkInClosed")
              : data.error === "Forbidden" || res.status === 403
                ? t("startTournamentForbidden")
                : t("startTournamentFailed")
      );
    }
    setLoading(false);
  }

  return (
    <section className="card mb-8 border-amber-500/30">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">{t("checkInTitle")}</h2>
          <p className="text-sm text-muted mt-1">{t("checkInHint")}</p>
        </div>
        <span className="badge bg-amber-500/15 text-amber-300 border border-amber-500/30">
          {t("checkInProgress", { checkedIn, total })}
        </span>
      </div>

      <ul className="space-y-2 mb-4">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center justify-between gap-3 py-2 border-b border-card-border last:border-0"
          >
            <span>
              {entry.name}
              {entry.tag ? ` [${entry.tag}]` : ""}
            </span>
            <span
              className={`text-sm ${
                entry.isCheckedIn ? "text-emerald-400" : "text-muted"
              }`}
            >
              {entry.isCheckedIn ? t("checkInConfirmed") : t("checkInPending")}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2 items-center">
        {canConfirmCheckIn && !hasConfirmedCheckIn && (
          <button
            type="button"
            onClick={handleConfirmCheckIn}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? "..." : t("confirmCheckIn")}
          </button>
        )}

        {hasConfirmedCheckIn && !isOrganizer && (
          <span className="badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {t("checkInYouConfirmed")}
          </span>
        )}

        {teamCheckInConfirmed && !isOrganizer && (
          <span className="badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            {t("checkInTeamConfirmed")}
          </span>
        )}

        {waitingForCaptainCheckIn && !isOrganizer && (
          <p className="text-sm text-muted">{t("checkInCaptainOnly")}</p>
        )}

        {isOrganizer && (
          <button
            type="button"
            onClick={handleStartTournament}
            disabled={
              loading ||
              !allCheckedIn ||
              total < minParticipants
            }
            className="btn btn-primary"
            title={
              total < minParticipants
                ? t("minParticipantsRequired", {
                    required: minParticipants,
                    current: total,
                  })
                : !allCheckedIn
                  ? t("checkInIncomplete")
                  : undefined
            }
          >
            {loading ? "..." : t("startTournament")}
          </button>
        )}
      </div>

      {message && <p className="text-sm text-red-400 mt-3">{message}</p>}
    </section>
  );
}
