import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { syncTournamentCompletionIfReady } from "@/lib/tournament-prizes";
import {
  TournamentStatusBadge,
  tournamentCardClass,
  tournamentStatusSortOrder,
} from "@/components/TournamentStatusBadge";

export default async function TournamentsPage() {
  const t = await getTranslations("tournaments");

  const tournaments = await prisma.tournament.findMany({
    include: {
      organizer: { select: { username: true } },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusById = new Map(
    await Promise.all(
      tournaments
        .filter((tournament) => tournament.status === "IN_PROGRESS")
        .map(async (tournament) => {
          const status = await syncTournamentCompletionIfReady(tournament.id);
          return [tournament.id, status ?? tournament.status] as const;
        })
    )
  );

  const tournamentsWithStatus = tournaments.map((tournament) => ({
    ...tournament,
    status: statusById.get(tournament.id) ?? tournament.status,
  }));

  const sortedTournaments = [...tournamentsWithStatus].sort((a, b) => {
    const order =
      (tournamentStatusSortOrder[a.status] ?? 99) -
      (tournamentStatusSortOrder[b.status] ?? 99);
    if (order !== 0) return order;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Link href="/tournaments/create" className="btn btn-primary">
          {t("create")}
        </Link>
      </div>

      {sortedTournaments.length === 0 ? (
        <p className="text-muted text-center py-12">{t("noTournaments")}</p>
      ) : (
        <div className="grid gap-4">
          {sortedTournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournaments/${tournament.id}`}
              className={`card hover:border-primary transition-colors ${tournamentCardClass(tournament.status)}`}
            >
              <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold break-words">{tournament.title}</h2>
                  <p className="text-sm text-muted mt-1">
                    {tournament.organizer.username} · {tournament._count.entries}{" "}
                    {t("participants")}
                  </p>
                  {tournament.status === "COMPLETED" && (
                    <p className="text-sm text-amber-300/90 mt-2 font-medium">
                      {t("tournamentFinishedHint")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <span className="badge bg-primary/20 text-primary">
                    {tournament.type === "SOLO" ? t("solo") : t("team")}
                  </span>
                  <TournamentStatusBadge
                    status={tournament.status}
                    label={t(`statuses.${tournament.status}`)}
                  />
                  {tournament.bandaiSupportStatus === "PENDING" && (
                    <span className="badge bg-card-border text-muted">
                      {t("bandaiStatusPending")}
                    </span>
                  )}
                  {tournament.bandaiSupportStatus === "APPROVED" && (
                    <span className="badge bg-sky-500/15 text-sky-300">
                      {t("bandaiStatusApproved")}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
