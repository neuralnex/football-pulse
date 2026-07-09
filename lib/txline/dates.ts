export const BOARD_TIMEZONE = 'Africa/Lagos';

export function getEpochDay(date: Date, timeZone = BOARD_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? 0);
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? 1);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function fixtureStartsOnEpochDay(
  startTimeMs: number,
  epochDay: number,
  timeZone = BOARD_TIMEZONE
): boolean {
  return getEpochDay(new Date(startTimeMs), timeZone) === epochDay;
}
