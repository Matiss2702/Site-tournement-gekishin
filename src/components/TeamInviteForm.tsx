"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function TeamInviteForm({ teamId }: { teamId: string }) {
  const t = useTranslations("teams");
  const [mode, setMode] = useState<"email" | "username">("username");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const trimmed = value.trim();
    if (!trimmed) {
      setMessage(t("inviteValueRequired"));
      setLoading(false);
      return;
    }

    const body =
      mode === "email" ? { email: trimmed } : { username: trimmed };

    const res = await fetch(`/api/teams/${teamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.emailSent) {
        setMessage(t("inviteSent"));
      } else if (data.emailError) {
        setMessage(`${t("inviteCreatedNoEmail")} ${data.emailError}`);
        if (data.inviteLink) {
          setMessage((m) => `${m}\n${t("inviteDevLink")}: ${data.inviteLink}`);
        }
      } else {
        setMessage(t("inviteSent"));
      }
      setValue("");
    } else {
      const data = await res.json();
      if (data.error === "already_in_team") {
        setMessage(t("alreadyInTeam"));
      } else {
        setMessage(data.error || "Failed to send invite");
      }
    }
    setLoading(false);
  }

  return (
    <div className="card">
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode("username")}
          className={`btn text-sm py-1 px-3 ${mode === "username" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("inviteByUsername")}
        </button>
        <button
          type="button"
          onClick={() => setMode("email")}
          className={`btn text-sm py-1 px-3 ${mode === "email" ? "btn-primary" : "btn-secondary"}`}
        >
          {t("inviteByEmail")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type={mode === "email" ? "email" : "text"}
          placeholder={mode === "email" ? "email@example.com" : "username"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          className="flex-1"
        />
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "..." : t("invite")}
        </button>
      </form>

      {message && (
        <p className="text-sm mt-2 text-muted">{message}</p>
      )}
    </div>
  );
}
