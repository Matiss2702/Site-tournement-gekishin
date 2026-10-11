export function formatTournamentStart(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export function getTournamentStartBlock(startDate: Date | null, now = new Date()) {
  if (!startDate) {
    return { ok: false as const, error: "start_date_required" as const };
  }
  if (startDate.getTime() > now.getTime()) {
    return {
      ok: false as const,
      error: "too_early" as const,
      startDate: startDate.toISOString(),
    };
  }
  return { ok: true as const };
}
