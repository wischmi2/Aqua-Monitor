export const HISTORY_ACTIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const HISTORY_RANGES = ["60m", "6h", "12h", "24h", "7d", "30d"] as const;
export type HistoryRange = typeof HISTORY_RANGES[number];

export interface HistorySensor {
  sensorType: string;
  label: string;
  unit: string;
  kind: "number" | "state";
  source: "sensor" | "solar";
}

export interface HistoryDevice {
  deviceId: string;
  name: string;
  lastReportedAt: string;
  sensors: HistorySensor[];
}

export interface HistoryReading {
  id: string;
  deviceId: string;
  sensorType: string;
  value: number | string | boolean;
  unit: string;
  recordedAt: string;
}

export function historyRangeStart(range: string, now = Date.now()): Date | null {
  const hours: Record<HistoryRange, number> = {
    "60m": 1, "6h": 6, "12h": 12, "24h": 24, "7d": 168, "30d": 720,
  };
  if (!Object.hasOwn(hours, range)) return null;
  return new Date(now - hours[range as HistoryRange] * 60 * 60 * 1000);
}

export function hasRecentHistoryReport(date: Date | string, now = Date.now()): boolean {
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp) && timestamp >= now - HISTORY_ACTIVE_WINDOW_MS
    && timestamp <= now;
}
