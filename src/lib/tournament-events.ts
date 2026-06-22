export const BRACKET_UPDATED_EVENT = "gekishin:bracket-updated";

export function notifyBracketUpdated(tournamentId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BRACKET_UPDATED_EVENT, { detail: { tournamentId } })
  );
}
