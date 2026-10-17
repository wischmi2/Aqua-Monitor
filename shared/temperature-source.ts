import type { Device, SensorReading } from "./schema";
import { hasRecentHardwareReport } from "./device-types";

export function selectTemperatureReading(
  readings: readonly SensorReading[], deviceId: string | null, now = Date.now(),
): SensorReading | undefined {
  return readings.filter((reading) =>
    reading.sensorType === "temperature" && reading.deviceId
    && (deviceId === null || reading.deviceId === deviceId)
    && hasRecentHardwareReport(reading.recordedAt, now))
    .reduce<SensorReading | undefined>((latest, reading) => {
      if (!latest) return reading;
      const difference = new Date(reading.recordedAt).getTime() - new Date(latest.recordedAt).getTime();
      return difference > 0 || (difference === 0 && reading.id > latest.id) ? reading : latest;
    }, undefined);
}

// Share Dashboard eligibility and tie-breaking with pages that follow its source.
export function selectDashboardTemperatureReading(
  readings: readonly SensorReading[], devices: readonly Device[],
  deviceId: string | null, now = Date.now(),
): SensorReading | undefined {
  const eligibleIds = new Set(devices
    .filter((device) => device.userId !== null && device.dashboardVisible === 1)
    .map((device) => device.goliothDeviceId));
  return selectTemperatureReading(
    readings.filter((reading) => !!reading.deviceId && eligibleIds.has(reading.deviceId)),
    deviceId, now,
  );
}

export function temperatureSourceError(
  value: unknown, userId: string, devices: readonly Device[], readings: readonly SensorReading[],
  now = Date.now(),
): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length === 0 || value.length > 200) {
    return "Choose Automatic or a valid temperature device";
  }
  const device = devices.find((item) => item.goliothDeviceId === value && item.userId === userId);
  if (!device || device.dashboardVisible === 0) {
    return "Temperature source must be one of your dashboard-enabled devices";
  }
  if (!selectTemperatureReading(readings.filter((reading) => reading.userId === userId), value, now)) {
    return "This device has not reported a temperature in the last hour";
  }
  return null;
}
