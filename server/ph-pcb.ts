import {
  PH_PCB_SENSOR_TYPES,
  type Device,
  type PhPcbDeviceData,
  type PhPcbSensorType,
  type SensorReading,
} from "@shared/schema";

export function parseEventTimestamp(value: unknown): Date | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value;
    const parsed = new Date(milliseconds);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  if (typeof value !== "string" || !value.trim()) return undefined;

  // JavaScript Date supports millisecond precision. Keep the first three
  // fractional digits so RFC3339 timestamps with nanoseconds remain valid.
  const normalized = value.trim().replace(
    /\.(\d{3})\d+(Z|[+-]\d{2}:\d{2})$/,
    ".$1$2",
  );
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export type TelemetryTimestampResult =
  | { ok: true; recordedAt: Date }
  | { ok: false; message: string };

export function resolveTelemetryTimestamp({
  ceTime,
  legacyTimestamp,
  hasPhPcbTelemetry,
  hasSolarPcbTelemetry = false,
  now = new Date(),
}: {
  ceTime: unknown;
  legacyTimestamp: unknown;
  hasPhPcbTelemetry: boolean;
  hasSolarPcbTelemetry?: boolean;
  now?: Date;
}): TelemetryTimestampResult {
  const eventTimestamp = parseEventTimestamp(ceTime);

  if ((hasPhPcbTelemetry || hasSolarPcbTelemetry) && !ceTime) {
    return {
      ok: false,
      message: `Event timestamp required for ${hasSolarPcbTelemetry ? "Solar" : "pH"} PCB telemetry`,
    };
  }
  if (ceTime && !eventTimestamp) {
    return { ok: false, message: "Invalid event timestamp" };
  }

  const recordedAt = eventTimestamp
    ?? parseEventTimestamp(legacyTimestamp)
    ?? now;
  if (recordedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    return { ok: false, message: "Invalid future event timestamp" };
  }

  return { ok: true, recordedAt };
}

export function isNamedPhPcbDevice(name: string): boolean {
  return /\b(?:ph|pcb)\b/i.test(name);
}

export function isPhPcbSensorType(sensorType: string): sensorType is PhPcbSensorType {
  return PH_PCB_SENSOR_TYPES.includes(sensorType as PhPcbSensorType);
}

export function isPhPcbClassifierSensorType(
  sensorType: string,
): sensorType is Exclude<PhPcbSensorType, "temp_c"> {
  return sensorType !== "temp_c" && isPhPcbSensorType(sensorType);
}

export function groupPhPcbReadings(
  readings: readonly SensorReading[],
  deviceList: readonly Device[],
): PhPcbDeviceData[] {
  const knownDeviceIds = new Set(
    deviceList.map((device) => device.goliothDeviceId),
  );
  const hiddenDeviceIds = new Set(
    deviceList
      .filter((device) => device.dashboardVisible === 0)
      .map((device) => device.goliothDeviceId),
  );
  const phPcbDeviceIds = new Set(
    deviceList
      .filter((device) => device.dashboardVisible !== 0 && isNamedPhPcbDevice(device.name))
      .map((device) => device.goliothDeviceId),
  );

  for (const reading of readings) {
    if (
      reading.deviceId
      && knownDeviceIds.has(reading.deviceId)
      && !hiddenDeviceIds.has(reading.deviceId)
      // Power and board-health fields are shared with other PCB types.
      // Only pH-specific measurements identify an otherwise unnamed pH board.
      && ["ph", "cal", "mv"].includes(reading.sensorType)
    ) {
      phPcbDeviceIds.add(reading.deviceId);
    }
  }

  const grouped = new Map<string, PhPcbDeviceData>(
    deviceList
      .filter((device) => device.dashboardVisible !== 0 && phPcbDeviceIds.has(device.goliothDeviceId))
      .map((device) => [
        device.goliothDeviceId,
        {
          deviceId: device.goliothDeviceId,
          deviceName: device.name,
          lastUpdated: null,
          readings: {},
        },
      ]),
  );
  for (const reading of readings) {
    if (!reading.deviceId || !phPcbDeviceIds.has(reading.deviceId)) continue;
    if (!isPhPcbSensorType(reading.sensorType)) continue;

    const sensorType = reading.sensorType;
    const existing = grouped.get(reading.deviceId);
    if (!existing) continue;

    const existingReading = existing.readings[sensorType];
    if (
      !existingReading
      || new Date(reading.recordedAt) > new Date(existingReading.recordedAt)
    ) {
      existing.readings[sensorType] = reading;
    }
    if (
      !existing.lastUpdated
      || new Date(reading.recordedAt) > new Date(existing.lastUpdated)
    ) {
      existing.lastUpdated = reading.recordedAt;
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    a.deviceName.localeCompare(b.deviceName),
  );
}