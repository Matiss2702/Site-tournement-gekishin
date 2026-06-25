import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isUserTeamMember } from "@/lib/user-teams";
import { TeamInviteForm } from "@/components/TeamInviteForm";
import { TeamMemberManager } from "@/components/TeamMemberManager";
import { LeaveTeamButton } from "@/components/LeaveTeamButton";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("teams");
  const session = await auth();

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      captain: { select: { id: true, username: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              discordId: true,
              discordUsername: true,
            },
          },
        },
        orderBy: [{ memberRole: "asc" }, { joinedAt: "asc" }],
      },
      invites: {
        where: { status: "PENDING" },
      },
    },
  });

  if (!team) notFound();

  const isMember = session?.user
    ? await isUserTeamMember(session.user.id, id)
    : false;

  if (!isMember) notFound();

  const isCaptain = session?.user?.id === team.captainId;
  const currentMembership = team.members.find(
    (m) => m.user.id === session?.user?.id
  );
  const otherMembersCount = team.members.filter(
    (m) => m.user.id !== session?.user?.id
  ).length;

  const openTournaments = isMember
    ? await prisma.tournament.findMany({
        where: { type: "TEAM", status: "REGISTRATION" },
        select: {
          id: true,
          title: true,
          _count: { select: { entries: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">
        {team.name}
        {team.tag && <span className="text-muted ml-2">[{team.tag}]</span>}
      </h1>
      <p className="text-muted mt-1">
        {t("captain")}: {team.captain.username}
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4">{t("members")}</h2>
        <TeamMemberManager
          teamId={id}
          captainId={team.captainId}
          isCaptain={isCaptain}
          members={team.members.map((m) => ({
            id: m.id,
            memberRole: m.memberRole,
            gameRole: m.gameRole,
            user: m.user,
          }))}
        />
      </section>

      {currentMembership && (
        <LeaveTeamButton
          teamId={id}
          memberId={currentMembership.id}
          isCaptain={isCaptain}
          hasOtherMembers={otherMembersCount > 0}
        />
      )}

      {isMember && openTournaments.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4">{t("openTournaments")}</h2>
          <div className="card space-y-2">
            {openTournaments.map((tournament) => (
              <Link
                key={tournament.id}
                href={`/tournaments/${tournament.id}?team=${id}`}
                className="flex items-center justify-between py-2 border-b border-card-border last:border-0 hover:text-primary transition-colors"
              >
                <span>{tournament.title}</span>
                <span className="text-sm text-muted">
                  {tournament._count.entries} {t("tournamentEntries")}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isCaptain && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4">{t("invite")}</h2>
          <TeamInviteForm teamId={id} />
        </section>
      )}

      {team.invites.length > 0 && isCaptain && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold mb-4">{t("pendingInvites")}</h2>
          <div className="card space-y-2">
            {team.invites.map((invite) => (
              <div key={invite.id} className="text-sm text-muted py-1">
                {invite.username || invite.email} — {invite.status}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
