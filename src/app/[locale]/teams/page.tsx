import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getUserTeamsWithDetails } from "@/lib/user-teams";

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("teams");
  const session = await auth();

  if (!session?.user) {
    redirect({ href: "/login", locale });
  }

  const teams = await getUserTeamsWithDetails(session!.user.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">{t("myTeamsTitle")}</h1>
        <Link href="/teams/create" className="btn btn-primary">
          {t("create")}
        </Link>
      </div>

      {teams.length === 0 ? (
        <p className="text-muted text-center py-12">{t("noMyTeams")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="card hover:border-primary transition-colors"
            >
              <h2 className="text-lg font-semibold">
                {team.name}
                {team.tag && (
                  <span className="text-muted ml-2">[{team.tag}]</span>
                )}
              </h2>
              <p className="text-sm text-muted mt-1">
                {t("captain")}: {team.captain.username} · {team._count.members}{" "}
                {t("members")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
