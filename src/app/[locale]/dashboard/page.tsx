import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import {
  getCaptainDrafts,
  getUserRegisteredTournaments,
  type CaptainDashboardItem,
} from "@/lib/user-dashboard";
import { TournamentStatusBadge } from "@/components/TournamentStatusBadge";

function outcomeLabel(
  item: CaptainDashboardItem,
  t: (key: string) => string
) {
  if (item.focus === "champion") return t("tournamentChampion");
  if (item.focus === "eliminated") {
    if (item.placement === 2) return t("tournamentRunnerUp");
    if (item.placement === 3) return t("tournamentThirdPlace");
    return t("tournamentEliminated");
  }
  if (item.focus === "upcoming_match") {
    if (item.draftComplete) return t("draftCompleteWaitingMatch");
    return t("upcomingMatch");
  }
  if (item.isActive) {
    return item.currentPhase === "HERO_PICK"
      ? t("draftPhasePick")
      : t("draftPhaseBan");
  }
  return t("draftWaiting");
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale });
  }

  const t = await getTranslations("dashboard");
  const tNav = await getTranslations("nav");
  const tTournaments = await getTranslations("tournaments");
  const userId = session!.user.id;

  const [myTeams, myTournaments, registeredTournaments, captainDrafts] =
    await Promise.all([
      prisma.teamMember.findMany({
        where: { userId },
        include: {
          team: {
            select: { id: true, name: true, tag: true, captainId: true },
          },
        },
      }),
      prisma.tournament.findMany({
        where: { organizerId: userId },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      getUserRegisteredTournaments(userId),
      getCaptainDrafts(userId),
    ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">
        {session!.user.name || session!.user.username}
      </h1>
      <p className="text-muted mb-8">@{session!.user.username}</p>

      {captainDrafts.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">{t("myDrafts")}</h2>
          <div className="space-y-3">
            {captainDrafts.map((draft) => (
              <div
                key={draft.tournamentId}
                className="card flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-semibold">{draft.tournamentTitle}</p>
                  <p className="text-sm text-muted mt-1">
                    {draft.myTeam.name}
                    {draft.myTeam.tag ? ` [${draft.myTeam.tag}]` : ""}
                    {draft.opponent && (
                      <>
                        {" "}
                        {t("vs")} {draft.opponent.name}
                        {draft.opponent.tag ? ` [${draft.opponent.tag}]` : ""}
                      </>
                    )}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`badge ${
                        draft.focus === "champion"
                          ? "bg-yellow-500/20 text-yellow-600"
                          : draft.focus === "eliminated"
                            ? "bg-card-border text-muted"
                            : "bg-primary/20 text-primary"
                      }`}
                    >
                      {outcomeLabel(draft, t)}
                    </span>
                    <TournamentStatusBadge
                      status={draft.tournamentStatus}
                      label={tTournaments(`statuses.${draft.tournamentStatus}`)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {draft.focus === "active_match" && draft.captainToken ? (
                    <Link
                      href={`/tournaments/${draft.tournamentId}/draft/captain/${draft.captainToken}`}
                      className="btn btn-primary"
                    >
                      {draft.currentPhase === "HERO_PICK"
                        ? t("goToPick")
                        : t("goToBan")}
                    </Link>
                  ) : (
                    <Link
                      href={`/tournaments/${draft.tournamentId}`}
                      className="btn btn-secondary"
                    >
                      {t("viewTournament")}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/tournaments/create"
          className="card hover:border-primary transition-colors"
        >
          <h3 className="font-semibold text-primary">+ {tNav("tournaments")}</h3>
          <p className="text-sm text-muted mt-1">{t("createTournamentHint")}</p>
        </Link>
        <Link
          href="/teams/create"
          className="card hover:border-primary transition-colors"
        >
          <h3 className="font-semibold text-primary">+ {tNav("teams")}</h3>
          <p className="text-sm text-muted mt-1">{t("createTeamHint")}</p>
        </Link>
        <Link
          href="/notifications"
          className="card hover:border-primary transition-colors"
        >
          <h3 className="font-semibold text-primary">{tNav("notifications")}</h3>
          <p className="text-sm text-muted mt-1">{t("notificationsHint")}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">
            {t("registeredTournaments")}
          </h2>
          {registeredTournaments.length === 0 ? (
            <p className="text-muted text-sm">{t("noRegisteredTournaments")}</p>
          ) : (
            <div className="space-y-2">
              {registeredTournaments.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/tournaments/${entry.tournament.id}`}
                  className="card block hover:border-primary transition-colors py-3"
                >
                  <span className="font-medium">{entry.tournament.title}</span>
                  {entry.team && (
                    <span className="text-muted text-sm ml-2">
                      — {entry.team.name}
                      {entry.team.tag ? ` [${entry.team.tag}]` : ""}
                    </span>
                  )}
                  <TournamentStatusBadge
                    status={entry.tournament.status}
                    label={tTournaments(`statuses.${entry.tournament.status}`)}
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">{t("myTeams")}</h2>
          {myTeams.length === 0 ? (
            <p className="text-muted text-sm">{t("noTeams")}</p>
          ) : (
            <div className="space-y-2">
              {myTeams.map((m) => (
                <Link
                  key={m.id}
                  href={`/teams/${m.team.id}`}
                  className="card block hover:border-primary transition-colors py-3"
                >
                  <span className="font-medium">{m.team.name}</span>
                  {m.team.tag && (
                    <span className="text-muted ml-2">[{m.team.tag}]</span>
                  )}
                  {m.team.captainId === userId && (
                    <span className="badge bg-primary/20 text-primary ml-2 text-xs">
                      {t("captainBadge")}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">{t("organizedTournaments")}</h2>
          {myTournaments.length === 0 ? (
            <p className="text-muted text-sm">{t("noOrganizedTournaments")}</p>
          ) : (
            <div className="space-y-2">
              {myTournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.id}`}
                  className="card block hover:border-primary transition-colors py-3"
                >
                  <span className="font-medium">{tournament.title}</span>
                  <TournamentStatusBadge
                    status={tournament.status}
                    label={tTournaments(`statuses.${tournament.status}`)}
                  />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
