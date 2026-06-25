import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { TournamentActions } from "@/components/TournamentActions";
import { MatchScoreManager } from "@/components/MatchScoreManager";
import { TournamentBracket } from "@/components/TournamentBracket";
import { MatchDraftsPanel } from "@/components/MatchDraftsPanel";
import { getUserTeams } from "@/lib/user-teams";
import { findTournamentRegistrationConflicts } from "@/lib/team-membership";
import {
  getCaptainDraftForTournament,
  getCaptainDraftsForTournament,
} from "@/lib/user-dashboard";
import { canManageDraft, canManageScores } from "@/lib/tournament-auth";
import { getUserTournamentPrize, syncTournamentCompletionIfReady } from "@/lib/tournament-prizes";
import { MIN_SOLO_PLAYERS, MIN_TEAM_ROSTER_SIZE, MIN_TOURNAMENT_PARTICIPANTS } from "@/lib/tournament-prize-config";
import { TournamentPrizeCard } from "@/components/TournamentPrizeCard";
import { TournamentParticipantsList } from "@/components/TournamentParticipantsList";
import { TournamentStatusBadge } from "@/components/TournamentStatusBadge";
import { TournamentCheckInPanel } from "@/components/TournamentCheckInPanel";
import { TournamentPodium } from "@/components/TournamentPodium";
import { getTournamentCheckInSummary, canUserConfirmCheckInForEntry, findUserTournamentEntry } from "@/lib/tournament-check-in";
import { soloTournamentUsesTeams } from "@/lib/tournament-random-teams";
import { getBracketSize } from "@/lib/bracket";
import { GRAND_FINAL_ROUND, getWinnersRoundCount } from "@/lib/bracket-progression";
import { resolveTournamentPlacements } from "@/lib/tournament-placements";
import {
  collectTeamsFromMatches,
  resolvePodiumEntry,
} from "@/lib/tournament-results";

export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale, id } = await params;
  const { team: preferredTeamId } = await searchParams;
  const t = await getTranslations("tournaments");
  const session = await auth();

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      organizer: { select: { id: true, username: true } },
      organizers: { select: { userId: true, permissions: true } },
      entries: {
        include: {
          user: { select: { id: true, username: true } },
          team: {
            select: {
              id: true,
              name: true,
              tag: true,
              captainId: true,
              captain: { select: { username: true } },
              members: {
                include: {
                  user: {
                    select: { id: true, username: true, displayName: true },
                  },
                },
              },
            },
          },
        },
      },
      matches: {
        include: {
          team1: { select: { id: true, name: true, tag: true } },
          team2: { select: { id: true, name: true, tag: true } },
          winner: { select: { id: true, name: true, tag: true } },
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
    },
  });

  if (!tournament) notFound();

  const syncedStatus = await syncTournamentCompletionIfReady(id);
  const tournamentStatus = syncedStatus ?? tournament.status;

  const title = tournament.title;
  const description = tournament.description;

  const isOrganizer = tournament.organizers.some(
    (o) => o.userId === session?.user?.id
  );

  const registeredTeamIds = new Set(
    tournament.entries
      .map((e) => e.teamId)
      .filter((teamId): teamId is string => !!teamId)
  );

  let availableTeams: {
    id: string;
    name: string;
    tag: string | null;
    memberCount: number;
  }[] = [];
  let alreadyJoined = false;
  let teamTooSmallForTournament = false;
  let memberConflictBlocksJoin = false;

  if (session?.user) {
    if (tournament.type === "SOLO") {
      alreadyJoined = tournament.entries.some(
        (e) => e.userId === session.user.id
      );
    } else {
      const userTeams = await getUserTeams(session.user.id);
      const unregistered = userTeams.filter((t) => !registeredTeamIds.has(t.id));

      for (const team of unregistered) {
        if (team._count.members < MIN_TEAM_ROSTER_SIZE) {
          teamTooSmallForTournament = true;
          continue;
        }
        const conflicts = await findTournamentRegistrationConflicts(id, team.id);
        if (conflicts.length > 0) {
          memberConflictBlocksJoin = true;
          continue;
        }
        availableTeams.push({
          id: team.id,
          name: team.name,
          tag: team.tag,
          memberCount: team._count.members,
        });
      }

      alreadyJoined =
        availableTeams.length === 0 &&
        userTeams.some((t) => registeredTeamIds.has(t.id));
    }
  }

  const captainDrafts = session?.user
    ? await getCaptainDraftsForTournament(session.user.id, id)
    : [];

  const captainDraft = session?.user
    ? await getCaptainDraftForTournament(session.user.id, id)
    : null;

  const canManage = session?.user
    ? await canManageDraft(id, session.user.id)
    : false;

  const canScore = session?.user
    ? await canManageScores(id, session.user.id)
    : false;

  const myPrize =
    session?.user && tournamentStatus === "COMPLETED"
      ? await getUserTournamentPrize(id, session.user.id)
      : null;

  const entryCount = tournament.entries.length;
  const soloUsesTeams = soloTournamentUsesTeams(
    tournament.type,
    tournament.entries
  );
  const capacity =
    tournament.type === "TEAM" ? tournament.maxTeams : tournament.maxPlayers;
  const registrationFull =
    capacity != null && entryCount >= capacity;

  const checkInSummary =
    tournament.status === "CHECK_IN"
      ? await getTournamentCheckInSummary(id)
      : null;

  const userId = session?.user?.id;
  let canConfirmCheckIn = false;
  let hasConfirmedCheckIn = false;
  let waitingForCaptainCheckIn = false;
  let teamCheckInConfirmed = false;

  if (userId && checkInSummary) {
    const userEntry = findUserTournamentEntry(tournament.entries, userId);
    if (userEntry) {
      const isCaptain = canUserConfirmCheckInForEntry(userEntry, userId);
      const entryCheckedIn = !!userEntry.checkedInAt;

      if (isCaptain) {
        hasConfirmedCheckIn = entryCheckedIn;
        canConfirmCheckIn = !entryCheckedIn;
      } else if (userEntry.team) {
        waitingForCaptainCheckIn = !entryCheckedIn;
        teamCheckInConfirmed = entryCheckedIn;
      }
    }
  }

  const bracketSize = getBracketSize(tournament.entries.length);
  let placements = resolveTournamentPlacements(
    tournament.format,
    bracketSize,
    tournament.matches
  );

  if (!placements?.first && tournamentStatus === "COMPLETED") {
    const grandFinal = tournament.matches.find(
      (match) =>
        match.round === GRAND_FINAL_ROUND &&
        match.matchNumber === 1 &&
        match.status === "completed" &&
        match.winnerId
    );
    const winnersFinal = tournament.matches.find(
      (match) =>
        match.round === getWinnersRoundCount(bracketSize) &&
        match.matchNumber === 1 &&
        match.status === "completed" &&
        match.winnerId
    );
    const decisive = grandFinal ?? winnersFinal;
    if (decisive?.winnerId) {
      placements = {
        first: decisive.winnerId,
        second:
          decisive.team1Id === decisive.winnerId
            ? decisive.team2Id
            : decisive.team1Id,
        third: placements?.third ?? null,
      };
    }
  }

  const matchTeams = collectTeamsFromMatches(tournament.matches);
  const championEntry = resolvePodiumEntry(
    placements?.first,
    tournament.entries,
    matchTeams
  );
  const runnerUpEntry = resolvePodiumEntry(
    placements?.second,
    tournament.entries,
    matchTeams
  );
  const thirdPlaceEntry = resolvePodiumEntry(
    placements?.third,
    tournament.entries,
    matchTeams
  );

  const showDraftSection = canManage || captainDrafts.length > 0;
  const draftHref = captainDraft?.isActive
    ? `/tournaments/${id}/draft/captain/${captainDraft.captainToken}`
    : `/tournaments/${id}/draft`;
  const draftLabel = captainDraft?.isActive
    ? captainDraft.currentPhase === "HERO_PICK"
      ? t("goToPick")
      : t("goToBan")
    : canManage
      ? t("manageDraft")
      : t("draft");

  const myAssignedTeam =
    session?.user && soloUsesTeams
      ? tournament.entries.find((entry) =>
          entry.team?.members.some(
            (member) => member.user.id === session.user!.id
          )
        )?.team ?? null
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="text-muted mt-2">
              {t("organizer")}: {tournament.organizer.username}
            </p>
          </div>
          <div className="flex gap-2">
            <span className="badge bg-primary/20 text-primary">
              {tournament.type === "SOLO" ? t("solo") : t("team")}
            </span>
            <TournamentStatusBadge
              status={tournamentStatus}
              label={t(`statuses.${tournamentStatus}`)}
            />
            {capacity != null && (
              <span
                className={`badge ${
                  registrationFull
                    ? "bg-accent/20 text-accent"
                    : "bg-card-border text-muted"
                }`}
              >
                {tournament.type === "TEAM"
                  ? t("teamsRegistered", { count: entryCount, max: capacity })
                  : t("playersRegistered", { count: entryCount, max: capacity })}
              </span>
            )}
          </div>
        </div>
        <p className="mt-4 text-foreground/80">{description}</p>
        {tournament.type === "SOLO" && tournamentStatus === "REGISTRATION" && (
          <p className="mt-2 text-sm text-muted">{t("soloRegisterHint")}</p>
        )}
        {myAssignedTeam && (
          <p className="mt-2 text-sm text-sky-400">
            {t("soloAssignedTeam", {
              team: `${myAssignedTeam.name}${myAssignedTeam.tag ? ` [${myAssignedTeam.tag}]` : ""}`,
            })}
          </p>
        )}
        {tournamentStatus === "COMPLETED" && (
          <p className="mt-2 text-sm text-amber-300/90">{t("tournamentFinishedHint")}</p>
        )}
      </div>

      {championEntry && (
        <TournamentPodium
          champion={championEntry}
          runnerUp={runnerUpEntry}
          thirdPlace={thirdPlaceEntry}
        />
      )}

      <div className="mb-8">
        <TournamentActions
          tournamentId={id}
          status={tournamentStatus}
          type={tournament.type}
          isOrganizer={isOrganizer}
          isLoggedIn={!!session?.user}
          availableTeams={availableTeams}
          alreadyJoined={alreadyJoined}
          preferredTeamId={preferredTeamId}
          registrationFull={registrationFull}
          teamTooSmallForTournament={teamTooSmallForTournament}
          memberConflictBlocksJoin={memberConflictBlocksJoin}
          minTeamRosterSize={MIN_TEAM_ROSTER_SIZE}
          entryCount={entryCount}
        />
        {!showDraftSection && (
          <Link
            href={draftHref}
            className={`btn mt-4 inline-flex ${
              captainDraft?.isActive ? "btn-primary" : "btn-secondary"
            }`}
          >
            {draftLabel}
          </Link>
        )}
      </div>

      {checkInSummary && (
        <TournamentCheckInPanel
          tournamentId={id}
          entries={checkInSummary.entries.map((entry) => ({
            id: entry.id,
            name: entry.name,
            tag: entry.tag,
            isCheckedIn: entry.isCheckedIn,
          }))}
          checkedIn={checkInSummary.checkedIn}
          total={checkInSummary.total}
          minParticipants={
            tournament.type === "SOLO" && !soloUsesTeams
              ? MIN_SOLO_PLAYERS
              : MIN_TOURNAMENT_PARTICIPANTS
          }
          allCheckedIn={checkInSummary.allCheckedIn}
          canConfirmCheckIn={canConfirmCheckIn}
          hasConfirmedCheckIn={hasConfirmedCheckIn}
          waitingForCaptainCheckIn={waitingForCaptainCheckIn}
          teamCheckInConfirmed={teamCheckInConfirmed}
          isOrganizer={isOrganizer}
        />
      )}

      {myPrize && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t("prizeSection")}</h2>
          <TournamentPrizeCard
            placement={myPrize.placement}
            code={myPrize.code}
            teamName={
              myPrize.team
                ? `${myPrize.team.name}${myPrize.team.tag ? ` [${myPrize.team.tag}]` : ""}`
                : null
            }
          />
        </section>
      )}

      {showDraftSection && (
        <section className="card mb-8 border-primary/30">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-xl font-semibold">{t("draftSection")}</h2>
            <Link
              href={draftHref}
              className={`btn ${
                captainDraft?.isActive ? "btn-primary" : "btn-secondary"
              }`}
            >
              {draftLabel}
            </Link>
          </div>

          {captainDrafts.length > 0 && (
            <div className="space-y-3 mb-6">
              {captainDrafts.map((draft) => (
                <div
                  key={draft.tournamentId}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-card-border last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
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
                    <p className="text-xs text-muted mt-1">
                      {draft.focus === "champion"
                        ? t("dashboardTournamentChampion")
                        : draft.focus === "eliminated"
                          ? draft.placement === 2
                            ? t("dashboardTournamentRunnerUp")
                            : draft.placement === 3
                              ? t("dashboardTournamentThirdPlace")
                              : t("dashboardTournamentEliminated")
                          : draft.isActive
                            ? draft.currentPhase === "HERO_PICK"
                              ? t("draftPhasePick")
                              : t("draftPhaseBan")
                            : t("draftWaiting")}
                    </p>
                  </div>
                  {draft.focus === "active_match" && draft.captainToken && (
                    <Link
                      href={`/tournaments/${id}/draft/captain/${draft.captainToken}`}
                      className="btn btn-primary text-sm py-1 px-3"
                    >
                      {draft.currentPhase === "HERO_PICK"
                        ? t("goToPick")
                        : t("goToBan")}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManage && (
            <>
              <p className="text-sm text-muted mb-4">{t("organizerDraftHint")}</p>
              <MatchDraftsPanel tournamentId={id} canManage={canManage} />
            </>
          )}
        </section>
      )}

      {(tournament.type === "TEAM" || soloUsesTeams) &&
        tournament.entries.length >= 2 &&
        (tournamentStatus === "IN_PROGRESS" ||
          tournamentStatus === "COMPLETED") && (
        <section className="mb-8 w-full min-w-0 overflow-x-auto">
          <h2 className="text-xl font-semibold mb-4">{t("bracketSection")}</h2>
          <TournamentBracket
            tournamentId={id}
            editable={canScore}
            format={tournament.format}
          />
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">{t("participants")}</h2>
          <div className="card p-4">
            <TournamentParticipantsList
              entries={tournament.entries.map((entry) => ({
                id: entry.id,
                wins: entry.wins,
                losses: entry.losses,
                score: entry.score,
                user: entry.user,
                team: entry.team
                  ? {
                      id: entry.team.id,
                      name: entry.team.name,
                      tag: entry.team.tag,
                      captain: entry.team.captain,
                      members: entry.team.members.map((m) => ({
                        id: m.id,
                        memberRole: m.memberRole,
                        gameRole: m.gameRole,
                        user: m.user,
                      })),
                    }
                  : null,
              }))}
            />
          </div>
        </section>

        {!((tournament.type === "TEAM" || soloUsesTeams) &&
          tournament.entries.length >= 2) && (
        <section>
          <h2 className="text-xl font-semibold mb-4">{t("matches")}</h2>
          {canScore ? (
            <MatchScoreManager
              tournamentId={id}
              matches={tournament.matches}
            />
          ) : (
            <div className="card space-y-2">
              {tournament.matches.length === 0 ? (
                <p className="text-muted text-sm">No matches yet</p>
              ) : (
                tournament.matches.map((match) => (
                  <div key={match.id} className="py-2 border-b border-card-border last:border-0">
                    <span>{match.team1?.name || "TBD"}</span>
                    <span className="mx-2 font-bold">
                      {match.score1} - {match.score2}
                    </span>
                    <span>{match.team2?.name || "TBD"}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
