export const DEVICE_TYPE_OPTIONS = [
  { value: "auto", label: "Automatic detection" },
  { value: "ph_pcb", label: "pH PCB" },
  { value: "solar_pcb", label: "Solar PCB" },
  { value: "sensor", label: "Other sensors" },
] as const;

export type DeviceType = typeof DEVICE_TYPE_OPTIONS[number]["value"];

export function isDeviceType(value: unknown): value is DeviceType {
  return DEVICE_TYPE_OPTIONS.some((option) => option.value === value);
}

export const HARDWARE_REPORT_WINDOW_MS = 60 * 60 * 1000;

export function hasRecentHardwareReport(
  date: Date | string | null | undefined,
  now = Date.now(),
): boolean {
  if (!date) return false;
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp)
    && timestamp >= now - HARDWARE_REPORT_WINDOW_MS
    && timestamp <= now + 5 * 60 * 1000;
}
