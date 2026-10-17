const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const INTERVALS = [
  SECOND, 5 * SECOND, 10 * SECOND, 30 * SECOND,
  MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
  DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY,
];

export function buildHistoryAxis(timestamps: readonly number[], containerWidth: number) {
  const valid = timestamps.filter(Number.isFinite);
  if (!valid.length) return { domain: [0, 1] as [number, number], ticks: [] as number[], span: 0 };
  const min = valid.reduce((a, b) => Math.min(a, b), Infinity);
  const max = valid.reduce((a, b) => Math.max(a, b), -Infinity);
  const span = max - min;
  if (!span) return { domain: [min - 30 * SECOND, max + 30 * SECOND] as [number, number], ticks: [min], span };

  // Leave room for the Y axis/margins, then budget ~110px for each time label.
  const budget = Math.max(2, Math.min(7, Math.floor((containerWidth - 100) / 110)));
  const interval = INTERVALS.find((step) => step >= span / (budget - 1))
    ?? Math.ceil(span / (budget - 1));
  const ticks: number[] = [];
  for (let time = Math.ceil(min / interval) * interval; time <= max; time += interval) {
    ticks.push(time);
  }
  // Very short or unaligned windows can contain no regular boundary.
  if (!ticks.length) ticks.push(min);
  return { domain: [min, max] as [number, number], ticks, span };
}

export function formatHistoryAxisTick(value: number, span: number, locale?: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  if (span <= DAY) {
    return date.toLocaleTimeString(locale, {
      hour: "numeric", minute: "2-digit",
      ...(span < 2 * MINUTE ? { second: "2-digit" as const } : {}),
    });
  }
  return date.toLocaleString(locale, {
    month: "short", day: "numeric",
    ...(span <= 2 * DAY ? { hour: "numeric" as const, minute: "2-digit" as const } : {}),
  });
}
