import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function BackToTournamentLink({ tournamentId }: { tournamentId: string }) {
  const t = await getTranslations("draft");

  return (
    <Link
      href={`/tournaments/${tournamentId}`}
      className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-4"
    >
      <span aria-hidden>←</span>
      {t("backToTournament")}
    </Link>
  );
}
