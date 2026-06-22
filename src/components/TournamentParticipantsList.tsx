"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type RosterMember = {
  id: string;
  memberRole: string;
  gameRole: string | null;
  user: {
    username: string;
    displayName: string | null;
  };
};

export type ParticipantEntry = {
  id: string;
  wins: number;
  losses: number;
  score: number;
  user: { username: string } | null;
  team: {
    id: string;
    name: string;
    tag: string | null;
    captain: { username: string };
    members: RosterMember[];
  } | null;
};

export function TournamentParticipantsList({
  entries,
}: {
  entries: ParticipantEntry[];
}) {
  const t = useTranslations("teams");
  const tRoles = useTranslations("roles");
  const [openId, setOpenId] = useState<string | null>(null);

  if (entries.length === 0) {
    return <p className="text-muted text-sm">No participants yet</p>;
  }

  return (
    <div className="space-y-0">
      {entries.map((entry) => {
        if (!entry.team) {
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between py-2 border-b border-card-border last:border-0"
            >
              <span>{entry.user?.username}</span>
              <span className="text-sm text-muted">
                W:{entry.wins} L:{entry.losses} · {entry.score} pts
              </span>
            </div>
          );
        }

        const team = entry.team;
        const isOpen = openId === entry.id;
        const members = [...team.members].sort((a, b) => {
          if (a.memberRole === "CAPTAIN") return -1;
          if (b.memberRole === "CAPTAIN") return 1;
          return a.user.username.localeCompare(b.user.username);
        });

        return (
          <div
            key={entry.id}
            className="border-b border-card-border last:border-0"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : entry.id)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left hover:text-primary transition-colors"
              aria-expanded={isOpen}
            >
              <span>
                {team.name}
                {team.tag && ` [${team.tag}]`}
                <span className="text-muted text-xs ml-2">
                  {isOpen ? "▾" : "▸"}
                </span>
              </span>
              <span className="text-sm text-muted shrink-0">
                W:{entry.wins} L:{entry.losses} · {entry.score} pts
              </span>
            </button>

            {isOpen && (
              <div className="pb-3 pl-2 space-y-2">
                <p className="text-xs text-muted">
                  {t("captain")}: {team.captain.username}
                </p>
                <ul className="space-y-1.5">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span>
                        {member.user.displayName || member.user.username}
                      </span>
                      <span className="badge bg-primary/15 text-primary text-xs">
                        {member.memberRole === "CAPTAIN"
                          ? t("roles.CAPTAIN")
                          : t(`roles.${member.memberRole}` as "roles.MEMBER")}
                      </span>
                      {member.gameRole && (
                        <span
                          className={`badge badge-${member.gameRole.toLowerCase()} text-xs`}
                        >
                          {tRoles(
                            member.gameRole as "TANK" | "SUPPORT" | "DPS"
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/teams/${team.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  {t("viewTeamDetails")}
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
