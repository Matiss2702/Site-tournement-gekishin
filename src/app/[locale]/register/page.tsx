"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";

function RegisterForm() {
  const t = useTranslations("auth");
  const tTeams = useTranslations("teams");
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const emailParam = searchParams.get("email");

  const [form, setForm] = useState({
    email: emailParam || "",
    username: "",
    password: "",
    displayName: "",
    locale: "fr",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteTeam, setInviteTeam] = useState<string | null>(null);
  const [emailLocked, setEmailLocked] = useState(!!emailParam);

  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/teams/invite/${inviteToken}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setInviteTeam(data.teamName);
          if (data.email) {
            setForm((f) => ({ ...f, email: data.email }));
            setEmailLocked(true);
          }
        }
      })
      .catch(() => {});
  }, [inviteToken, emailParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        inviteToken: inviteToken || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || t("registerError"));
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", {
      identifier: form.email,
      password: form.password,
      redirect: false,
    });

    if (signInResult?.error) {
      router.push("/login");
      return;
    }

    await router.refresh();

    if (data.teamId) {
      router.push(`/teams/${data.teamId}`);
    } else if (inviteToken) {
      router.push(`/teams/invite/${inviteToken}`);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">{t("registerTitle")}</h1>

        {inviteToken && inviteTeam && (
          <p className="text-sm text-center text-sky-400 mb-4">
            {tTeams("inviteRegisterBanner", { team: inviteTeam })}
          </p>
        )}

        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t("email")}</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              readOnly={emailLocked}
              className={emailLocked ? "opacity-80" : ""}
            />
            {emailLocked && (
              <p className="text-xs text-muted mt-1">{tTeams("inviteEmailLocked")}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("username")}</label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              minLength={3}
              maxLength={20}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("displayName")}</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("password")}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading
              ? "..."
              : inviteToken
                ? tTeams("inviteRegisterCta")
                : t("registerButton")}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          {t("hasAccount")}{" "}
          <Link
            href={inviteToken ? `/login?invite=${inviteToken}` : "/login"}
            className="text-primary hover:underline"
          >
            {t("loginButton")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
