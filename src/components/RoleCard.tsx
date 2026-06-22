"use client";

import type { GameRole } from "./HeroCard";

const roleThemes: Record<
  GameRole,
  { border: string; gradient: string; icon: string }
> = {
  TANK: {
    border: "#4ade80",
    gradient: "linear-gradient(105deg, #15803d 0%, #22c55e 40%, #dcfce7 100%)",
    icon: "#16a34a",
  },
  SUPPORT: {
    border: "#38bdf8",
    gradient: "linear-gradient(105deg, #0369a1 0%, #0ea5e9 40%, #e0f2fe 100%)",
    icon: "#0284c7",
  },
  DPS: {
    border: "#f87171",
    gradient: "linear-gradient(105deg, #b91c1c 0%, #ef4444 40%, #fee2e2 100%)",
    icon: "#dc2626",
  },
};

function RoleEmblem({ role }: { role: GameRole }) {
  const fill = "rgba(255,255,255,0.35)";
  if (role === "TANK") {
    return (
      <svg viewBox="0 0 64 64" className="w-16 h-16" fill={fill}>
        <path d="M32 4L8 12v16c0 13.4 9.1 25.9 24 29 14.9-3.1 24-15.6 24-29V12L32 4z" />
      </svg>
    );
  }
  if (role === "SUPPORT") {
    return (
      <svg viewBox="0 0 64 64" className="w-16 h-16" fill={fill}>
        <path d="M52 8H12c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4V12c0-2.2-1.8-4-4-4zm-4 28H36v12h-8V36H16v-8h12V16h8v12h12v8z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill={fill}>
      <path d="M18.5 14H13.7c-.2 0-.5.1-.6.3l-.03.03-6.7 6.7a1.3 1.3 0 0 0-.4.9V30c0 .75.6 1.35 1.35 1.35h4.75L17.3 50h29.4l3.6-18.65H54.65c.75 0 1.35-.6 1.35-1.35V21.26a1.3 1.3 0 0 0-.4-.93l-6.7-6.7-.03-.03a.9.9 0 0 0-.6-.3h-4.8L40 6H24l-5.5 8z" />
    </svg>
  );
}

interface RoleCardProps {
  role: GameRole;
  label: string;
  description: string;
  banned?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function RoleCard({
  role,
  label,
  description,
  banned = false,
  selected = false,
  onClick,
}: RoleCardProps) {
  const theme = roleThemes[role];

  return (
    <button
      type="button"
      onClick={!banned ? onClick : undefined}
      disabled={banned}
      className={[
        "hero-card role-card w-full text-left",
        !banned && onClick && "hero-card-interactive cursor-pointer",
        selected && "hero-card-selected",
        banned && "hero-card-banned",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--hero-border": theme.border,
          "--hero-gradient": theme.gradient,
          "--hero-icon-bg": theme.icon,
        } as React.CSSProperties
      }
    >
      <div className="hero-card-inner role-card-inner">
        <div className="hero-card-text role-card-text">
          <span className="hero-card-name text-2xl">{label}</span>
          <span className="hero-card-subtitle">{description}</span>
        </div>

        <div className="role-card-emblem" aria-hidden>
          <RoleEmblem role={role} />
        </div>

        {banned && (
          <div className="hero-card-overlay hero-card-overlay-ban">
            <span className="hero-card-stamp">BAN</span>
          </div>
        )}
      </div>
    </button>
  );
}
