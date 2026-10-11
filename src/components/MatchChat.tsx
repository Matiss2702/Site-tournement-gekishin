"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; username: string; displayName: string | null };
  team: { id: string; name: string; tag: string | null };
};

type TeamInfo = { id: string; name: string; tag: string | null };

interface MatchChatProps {
  tournamentId: string;
  matchId: string;
  compact?: boolean;
}

function teamLabel(team: TeamInfo) {
  return team.tag ? `${team.name} [${team.tag}]` : team.name;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MatchChat({ tournamentId, matchId, compact = false }: MatchChatProps) {
  const t = useTranslations("matchChat");
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [team1, setTeam1] = useState<TeamInfo | null>(null);
  const [team2, setTeam2] = useState<TeamInfo | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const fetchMessages = useCallback(async () => {
    if (status !== "authenticated") return;

    const res = await fetch(
      `/api/tournaments/${tournamentId}/matches/${matchId}/chat`
    );

    if (res.status === 401 || res.status === 403) {
      setForbidden(true);
      return;
    }
    if (!res.ok) return;

    const data = await res.json();
    setForbidden(false);
    setMyTeamId(data.myTeamId ?? null);
    setTeam1(data.team1 ?? null);
    setTeam2(data.team2 ?? null);
    setMessages((data.messages ?? []) as ChatMessage[]);
  }, [tournamentId, matchId, status]);

  useEffect(() => {
    setMessages([]);
    void fetchMessages();
    const interval = setInterval(() => void fetchMessages(), 2000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;

    setSending(true);
    setError("");
    const res = await fetch(
      `/api/tournaments/${tournamentId}/matches/${matchId}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        data.error === "empty_message"
          ? t("emptyMessage")
          : data.error === "forbidden"
            ? t("forbidden")
            : t("sendFailed")
      );
      setSending(false);
      return;
    }

    const message = (await res.json()) as ChatMessage;
    setDraft("");
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message]
    );
    stickToBottomRef.current = true;
    scrollToBottom();
    setSending(false);
  }

  if (status === "loading") {
    return (
      <section className="card border-card-border">
        <p className="text-sm text-muted">{t("loading")}</p>
      </section>
    );
  }

  if (status !== "authenticated") {
    return (
      <section className="card border-card-border">
        <h3 className="font-semibold mb-1">{t("title")}</h3>
        <p className="text-sm text-muted">{t("loginRequired")}</p>
      </section>
    );
  }

  if (forbidden) {
    return null;
  }

  return (
    <section
      className={`card border-sky-500/25 flex flex-col ${
        compact ? "min-h-[280px]" : "min-h-[360px]"
      }`}
    >
      <div className="mb-3">
        <h3 className="font-semibold">{t("title")}</h3>
        <p className="text-xs text-muted mt-1">
          {team1 && team2
            ? t("matchup", {
                team1: teamLabel(team1),
                team2: teamLabel(team2),
              })
            : t("hint")}
        </p>
      </div>

      <div
        ref={listRef}
        onScroll={() => {
          const el = listRef.current;
          if (!el) return;
          stickToBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="flex-1 overflow-y-auto space-y-2 rounded-lg border border-card-border bg-background/40 p-3 mb-3"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted">{t("empty")}</p>
        ) : (
          messages.map((message) => {
            const mine = message.user.id === session?.user?.id;
            const ally = message.team.id === myTeamId;
            return (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  mine
                    ? "bg-primary/15 border border-primary/25"
                    : ally
                      ? "bg-card border border-card-border"
                      : "bg-amber-500/10 border border-amber-500/20"
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-0.5">
                  <span className="font-medium">
                    {message.user.displayName || message.user.username}
                  </span>
                  <span className="text-xs text-muted">
                    {teamLabel(message.team)}
                  </span>
                  <span className="text-xs text-muted ml-auto">
                    {formatTime(message.createdAt)}
                  </span>
                </div>
                <p className="leading-relaxed break-words">{message.body}</p>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder={t("placeholder")}
          className="flex-1"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="btn btn-primary shrink-0"
        >
          {sending ? "…" : t("send")}
        </button>
      </form>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </section>
  );
}
