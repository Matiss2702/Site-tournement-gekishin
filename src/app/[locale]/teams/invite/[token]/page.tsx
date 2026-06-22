"use client";

import { use, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

interface InviteInfo {
  teamName: string;
  teamTag: string | null;
  inviterName: string;
  email: string | null;
  requiresRegistration: boolean;
}

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data: session, status } = useSession();
  const t = useTranslations("teams");
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setInviteLoading(true);
    setFetchError("");

    fetch(`/api/teams/invite/${token}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setFetchError(data.error || t("inviteInvalid"));
          return;
        }
        setInvite(await res.json());
      })
      .catch(() => {
        if (!cancelled) setFetchError(t("inviteInvalid"));
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  async function acceptInvite() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/teams/invite/${token}`, { method: "POST" });

      if (res.ok) {
        const data = await res.json();
        router.push(`/teams/${data.teamId}`);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data.error === "already_in_team") {
        setError(t("alreadyInTeam"));
      } else {
        setError(data.error || t("inviteAcceptFailed"));
      }
    } catch {
      setError(t("inviteAcceptFailed"));
    } finally {
      setLoading(false);
    }
  }

  if (fetchError) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="card w-full max-w-md text-center">
          <p className="text-danger">{fetchError}</p>
        </div>
      </div>
    );
  }

  if (inviteLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="card w-full max-w-md text-center text-muted">...</div>
      </div>
    );
  }

  if (!invite) {
    return null;
  }

  const teamLabel = invite.teamTag
    ? `${invite.teamName} [${invite.teamTag}]`
    : invite.teamName;

  const registerHref = `/register?invite=${token}${invite.email ? `&email=${encodeURIComponent(invite.email)}` : ""}`;
  const loginHref = `/login?invite=${token}`;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <div className="card w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">{t("inviteTitle")}</h1>
        <p className="text-muted mb-6">
          {t("inviteMessage", {
            inviter: invite.inviterName,
            team: teamLabel,
          })}
        </p>

        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {status === "loading" ? (
          <p className="text-sm text-muted">...</p>
        ) : !session?.user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t("inviteRegisterHint")}</p>
            <Link href={registerHref} className="btn btn-primary w-full block">
              {t("inviteRegisterCta")}
            </Link>
            <Link href={loginHref} className="btn btn-secondary w-full block">
              {t("inviteLoginCta")}
            </Link>
          </div>
        ) : (
          <button
            onClick={acceptInvite}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? "..." : t("inviteAccept")}
          </button>
        )}
      </div>
    </div>
  );
}
