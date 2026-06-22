"use client";

import { HeroCard, type GameRole } from "./HeroCard";

interface BanConfirmBarProps {
  heroName: string;
  role: GameRole;
  roleLabel: string;
  imageUrl: string | null;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function BanConfirmBar({
  heroName,
  role,
  roleLabel,
  imageUrl,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  loading,
}: BanConfirmBarProps) {
  return (
    <div className="ban-confirm-bar">
      <div className="ban-confirm-preview">
        <HeroCard
          name={heroName}
          role={role}
          roleLabel={roleLabel}
          imageUrl={imageUrl}
          state="available"
          selected
        />
      </div>
      <p className="ban-confirm-text">{heroName}</p>
      <div className="ban-confirm-actions">
        <button
          type="button"
          className="ban-confirm-btn ban-confirm-cancel"
          onClick={onCancel}
          disabled={loading}
          aria-label={cancelLabel}
        >
          ✕
        </button>
        <button
          type="button"
          className="ban-confirm-btn ban-confirm-ok"
          onClick={onConfirm}
          disabled={loading}
          aria-label={confirmLabel}
        >
          ✓
        </button>
      </div>
    </div>
  );
}
