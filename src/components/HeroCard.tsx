"use client";

import Image from "next/image";

export type GameRole = "TANK" | "SUPPORT" | "DPS";
export type HeroCardState = "available" | "banned" | "picked" | "disabled";

const roleThemes: Record<
  GameRole,
  { border: string; gradient: string; icon: string; glow: string }
> = {
  TANK: {
    border: "#4ade80",
    gradient: "linear-gradient(105deg, #15803d 0%, #22c55e 35%, #bbf7d0 100%)",
    icon: "#16a34a",
    glow: "rgba(74, 222, 128, 0.6)",
  },
  SUPPORT: {
    border: "#38bdf8",
    gradient: "linear-gradient(105deg, #0369a1 0%, #0ea5e9 35%, #bae6fd 100%)",
    icon: "#0284c7",
    glow: "rgba(56, 189, 248, 0.6)",
  },
  DPS: {
    border: "#f87171",
    gradient: "linear-gradient(105deg, #b91c1c 0%, #ef4444 35%, #fecaca 100%)",
    icon: "#dc2626",
    glow: "rgba(248, 113, 113, 0.6)",
  },
};

function RoleIcon({ role }: { role: GameRole }) {
  const fill = "white";
  if (role === "TANK") {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill={fill}>
        <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
      </svg>
    );
  }
  if (role === "SUPPORT") {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill={fill}>
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill={fill}>
      <path d="M6.92 5H5.14c-.09 0-.17.04-.24.1l-.01.01-2.5 2.5a.5.5 0 0 0-.14.35V11c0 .28.22.5.5.5h1.78L6.5 19h11l1.36-7.5H20.5c.28 0 .5-.22.5-.5V7.96a.5.5 0 0 0-.14-.35l-2.5-2.5-.01-.01a.34.34 0 0 0-.24-.1H17.08L15 2H9l-2.08 3z" />
    </svg>
  );
}

interface HeroCardProps {
  name: string;
  subtitle?: string;
  role: GameRole;
  roleLabel: string;
  imageUrl?: string | null;
  state?: HeroCardState;
  teamName?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function HeroCard({
  name,
  subtitle,
  role,
  roleLabel,
  imageUrl,
  state = "available",
  teamName,
  selected = false,
  onClick,
}: HeroCardProps) {
  const theme = roleThemes[role];
  const isInteractive = state === "available" && !!onClick;
  const isBanned = state === "banned";
  const isPicked = state === "picked";

  return (
    <button
      type="button"
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      className={[
        "hero-card group relative w-full text-left",
        isInteractive && "hero-card-interactive cursor-pointer",
        selected && "hero-card-selected",
        isBanned && "hero-card-banned",
        isPicked && "hero-card-picked",
        state === "disabled" && "hero-card-disabled",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--hero-border": theme.border,
          "--hero-gradient": theme.gradient,
          "--hero-icon-bg": theme.icon,
          "--hero-glow": theme.glow,
        } as React.CSSProperties
      }
    >
      <div className="hero-card-inner">
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt=""
              fill
              className="hero-card-banner object-cover object-center"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
            <div className="hero-card-banner-name">
              <span className="hero-card-name">{name}</span>
              {subtitle && <span className="hero-card-subtitle">{subtitle}</span>}
            </div>
          </>
        ) : (
          <>
            <div className="hero-card-icon">
              <RoleIcon role={role} />
            </div>

            <div className="hero-card-text">
              <span className="hero-card-role">{roleLabel}</span>
              <span className="hero-card-name">{name}</span>
              {subtitle && <span className="hero-card-subtitle">{subtitle}</span>}
            </div>

            <div className="hero-card-portrait">
              <span className="hero-card-initial" aria-hidden>
                {name.charAt(0)}
              </span>
            </div>
          </>
        )}

        {isBanned && (
          <div className="hero-card-overlay hero-card-overlay-ban">
            <span className="hero-card-stamp">BAN</span>
          </div>
        )}

        {isPicked && (
          <div className="hero-card-overlay hero-card-overlay-pick">
            {teamName && (
              <span className="hero-card-team-badge">{teamName}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
