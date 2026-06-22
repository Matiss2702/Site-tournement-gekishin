type TournamentStatus =
  | "DRAFT"
  | "REGISTRATION"
  | "CHECK_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

const statusClass: Record<TournamentStatus, string> = {
  DRAFT: "tournament-status-draft",
  REGISTRATION: "tournament-status-registration",
  CHECK_IN: "tournament-status-check-in",
  IN_PROGRESS: "tournament-status-in-progress",
  COMPLETED: "tournament-status-completed",
  CANCELLED: "tournament-status-cancelled",
};

export function tournamentCardClass(status: string) {
  return status === "COMPLETED" ? "tournament-card-completed" : "";
}

export function TournamentStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const cls = statusClass[status as TournamentStatus] ?? "tournament-status-draft";

  return (
    <span className={`badge tournament-status-badge ${cls}`}>
      {status === "COMPLETED" ? `🏆 ${label}` : label}
    </span>
  );
}

export const tournamentStatusSortOrder: Record<string, number> = {
  IN_PROGRESS: 0,
  CHECK_IN: 1,
  REGISTRATION: 2,
  DRAFT: 3,
  COMPLETED: 4,
  CANCELLED: 5,
};
