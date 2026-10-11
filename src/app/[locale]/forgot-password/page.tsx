"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });

    if (res.ok) {
      setSent(true);
    } else {
      setError(t("forgotPasswordError"));
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">{t("forgotPasswordTitle")}</h1>

        {sent ? (
          <div className="bg-success/10 border border-success/30 text-success rounded-lg p-3 mt-4 text-sm">
            {t("forgotPasswordSent")}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted text-center mb-6">{t("forgotPasswordHint")}</p>

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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? "..." : t("forgotPasswordButton")}
              </button>
            </form>
          </>
        )}

        <p className="text-center text-sm text-muted mt-6">
          <Link href="/login" className="text-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
