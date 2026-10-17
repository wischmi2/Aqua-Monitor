import {
  SOLAR_PCB_METRICS,
  type Device,
  type SolarPcbDeviceData,
  type SolarPcbPayload,
  type SolarPcbReading,
} from "@shared/schema";

const numericFields = new Set(["ibat_ma", "soc_pct", "vbat_mv", "vbat_rise_mv"]);
const booleanFields = new Set(["aem", "usb_cc", "vbus"]);

export function extractSolarPcbPayload(payload: unknown): SolarPcbPayload {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as Record<string, any>;
  const candidates = [root, root.data, root.data?.value, root.value, root.data?.data]
    .filter((item) => item && typeof item === "object");
  const result: SolarPcbPayload = {};
  for (const key of SOLAR_PCB_METRICS) {
    for (const candidate of candidates) {
      const value: unknown = candidate[key];
      const valid = numericFields.has(key)
        ? typeof value === "number" && Number.isFinite(value)
        : booleanFields.has(key)
          ? typeof value === "boolean"
          : typeof value === "string" && value.trim().length > 0;
      if (valid) {
        result[key] = value as number | string | boolean;
        break;
      }
    }
  }
  return result;
}

export function hasSolarPcbTelemetry(payload: SolarPcbPayload): boolean {
  // vbus is shared with the pH board and cannot identify a solar board alone.
  return SOLAR_PCB_METRICS.some((key) => key !== "vbus" && payload[key] !== undefined);
}

export function groupSolarPcbReadings(
  readings: readonly SolarPcbReading[],
  devices: readonly Device[],
): SolarPcbDeviceData[] {
  const telemetryDeviceIds = new Set(readings.map((reading) => reading.deviceId));
  const grouped = new Map<string, SolarPcbDeviceData>(
    devices
      .filter((device) => device.userId && device.dashboardVisible !== 0
        && (device.deviceType === "solar_pcb"
          || telemetryDeviceIds.has(device.goliothDeviceId) || /\bsolar\b/i.test(device.name)))
      .map((device) => [device.goliothDeviceId, {
        deviceId: device.goliothDeviceId,
        deviceName: device.name,
        lastUpdated: null,
        readings: {},
      }]),
  );
  for (const event of readings) {
    const group = grouped.get(event.deviceId);
    if (!group) continue;
    for (const key of SOLAR_PCB_METRICS) {
      const value = event.payload[key];
      if (value === undefined) continue;
      const current = group.readings[key];
      if (!current || new Date(event.recordedAt) > new Date(current.recordedAt)) {
        group.readings[key] = { value, recordedAt: event.recordedAt };
      }
    }
    if (!group.lastUpdated || new Date(event.recordedAt) > new Date(group.lastUpdated)) {
      group.lastUpdated = event.recordedAt;
    }
  }
  return Array.from(grouped.values()).sort((a, b) => a.deviceName.localeCompare(b.deviceName));
}
