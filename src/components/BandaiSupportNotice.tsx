import { useTranslations } from "next-intl";
import {
  BANDAI_OFFICIAL_NOTICE,
  BANDAI_SUPPORT_TERMS_URL,
} from "@/lib/bandai-support";

export function BandaiSupportNotice({ status }: { status: string }) {
  const t = useTranslations("tournaments");

  if (status === "APPROVED") {
    return (
      <footer className="mt-16 border-t border-card-border pt-6 pb-2 text-xs sm:text-sm text-muted leading-relaxed space-y-2">
        <p className="text-foreground/80">{BANDAI_OFFICIAL_NOTICE}</p>
        <p>
          <a
            href={BANDAI_SUPPORT_TERMS_URL}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            {t("bandaiTermsLink")}
          </a>
        </p>
        <p>©BIRD STUDIO/SHUEISHA, TOEI ANIMATION</p>
        <p>©Bandai Namco Entertainment Inc.</p>
      </footer>
    );
  }

  if (status === "PENDING") {
    return (
      <p className="mt-8 text-sm text-muted border border-card-border rounded-lg px-4 py-3">
        {t("bandaiPendingNotice")}
      </p>
    );
  }

  return null;
}
