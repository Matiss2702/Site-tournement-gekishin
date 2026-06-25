"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

interface DiscordLinkCardProps {
  locale: string;
  discordUsername: string | null;
  configured: boolean;
}

export function DiscordLinkCard({
  locale,
  discordUsername,
  configured,
}: DiscordLinkCardProps) {
  const t = useTranslations("discord");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const status = searchParams.get("discord");
    if (!status) return;

    if (status === "linked") setMessage(t("linkedSuccess"));
    else if (status === "denied") setMessage(t("linkDenied"));
    else if (status === "already_linked") setMessage(t("alreadyLinkedOther"));
    else if (status === "error") setMessage(t("linkFailed"));

    router.replace(`/${locale}/dashboard`);
  }, [searchParams, t, router, locale]);

  async function handleUnlink() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/discord/unlink", { method: "POST" });
    if (res.ok) {
      setMessage(t("unlinkedSuccess"));
      router.refresh();
    } else {
      setMessage(t("unlinkFailed"));
    }
    setLoading(false);
  }

  return (
    <section className="card mb-10 border-[#5865F2]/30">
      <h2 className="text-xl font-semibold mb-2">{t("title")}</h2>
      <p className="text-sm text-muted mb-4">{t("hint")}</p>

      {!configured ? (
        <p className="text-sm text-amber-400">{t("notConfigured")}</p>
      ) : discordUsername ? (
        <div className="space-y-3">
          <p className="text-sm">
            {t("connectedAs")}{" "}
            <span className="text-[#5865F2] font-medium">{discordUsername}</span>
          </p>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? "..." : t("unlink")}
          </button>
        </div>
      ) : (
        <a
          href={`/api/discord/link?locale=${locale}`}
          className="btn btn-primary inline-flex"
        >
          {t("link")}
        </a>
      )}

      {message && <p className="text-sm text-muted mt-3">{message}</p>}
    </section>
  );
}
