"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type MemberRole = "CAPTAIN" | "MEMBER" | "SUBSTITUTE";

interface Member {
  id: string;
  memberRole: MemberRole;
  gameRole: string | null;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    discordId?: string | null;
    discordUsername?: string | null;
  };
}

interface TeamMemberManagerProps {
  teamId: string;
  captainId: string;
  members: Member[];
  isCaptain: boolean;
}

export function TeamMemberManager({
  teamId,
  captainId,
  members,
  isCaptain,
}: TeamMemberManagerProps) {
  const t = useTranslations("teams");
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function updateRole(memberId: string, memberRole: MemberRole) {
    setLoadingId(memberId);
    await fetch(`/api/teams/${teamId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberRole }),
    });
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div className="card space-y-2">
      {members.map((member) => {
        const isTeamCaptain = member.user.id === captainId;
        const roleLabel = isTeamCaptain
          ? t("roles.CAPTAIN")
          : t(`roles.${member.memberRole}`);

        return (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 py-2 border-b border-card-border last:border-0"
          >
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="truncate">
                {member.user.displayName || member.user.username}
              </span>
              {member.user.discordUsername && member.user.discordId && (
                <a
                  href={`https://discord.com/users/${member.user.discordId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge bg-[#5865F2]/20 text-[#5865F2] shrink-0 text-xs hover:bg-[#5865F2]/30"
                  title={t("discordTeammateHint")}
                >
                  {member.user.discordUsername}
                </a>
              )}
              {!isCaptain || isTeamCaptain ? (
                <span className="badge bg-primary/20 text-primary shrink-0">
                  {roleLabel}
                </span>
              ) : (
                <select
                  value={member.memberRole}
                  disabled={loadingId === member.id}
                  onChange={(e) =>
                    updateRole(member.id, e.target.value as MemberRole)
                  }
                  className="!w-auto text-sm"
                >
                  <option value="MEMBER">{t("roles.MEMBER")}</option>
                  <option value="SUBSTITUTE">{t("roles.SUBSTITUTE")}</option>
                  <option value="CAPTAIN">{t("roles.CAPTAIN")}</option>
                </select>
              )}
            </div>
            {member.gameRole && (
              <span className={`badge badge-${member.gameRole.toLowerCase()} shrink-0`}>
                {member.gameRole}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
