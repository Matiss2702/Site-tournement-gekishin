"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export default function CreateTeamPage() {
  const t = useTranslations("teams");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", tag: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        ...(form.tag.trim() ? { tag: form.tag.trim() } : {}),
      }),
    });

    if (res.ok) {
      const team = await res.json();
      router.push(`/teams/${team.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      if (data.error === "already_in_team") {
        setError(t("alreadyInTeam"));
      } else if (data.error === "Invalid input") {
        setError(t("invalidTeamInput"));
      } else {
        setError(
          process.env.NODE_ENV === "development" && data.details
            ? data.details
            : t("createFailed")
        );
      }
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{t("create")}</h1>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("name")}</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("tag")}</label>
          <input
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.target.value })}
            maxLength={6}
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? "..." : t("create")}
        </button>
      </form>
    </div>
  );
}
