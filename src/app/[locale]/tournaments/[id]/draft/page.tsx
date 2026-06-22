import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageDraft } from "@/lib/tournament-auth";
import { MatchDraftsPanel } from "@/components/MatchDraftsPanel";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("draft");
  const session = await auth();

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { title: true },
  });

  if (!tournament) notFound();

  const canManage = session?.user
    ? await canManageDraft(id, session.user.id)
    : false;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2 italic tracking-tight">{t("title")}</h1>
      <p className="text-muted mb-2">{tournament.title}</p>
      <p className="text-sm text-muted mb-8">
        {canManage ? t("organizerSpectatorHint") : t("spectatorOnly")}
      </p>
      <MatchDraftsPanel tournamentId={id} canManage={canManage} />
    </div>
  );
}
