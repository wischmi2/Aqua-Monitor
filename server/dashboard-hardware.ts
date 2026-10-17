import type { Device, SensorReading, SolarPcbReading } from "@shared/schema";
import { hasRecentHardwareReport, type DeviceType } from "@shared/device-types";
import { groupPhPcbReadings, isNamedPhPcbDevice } from "./ph-pcb";
import { groupSolarPcbReadings } from "./solar-pcb";

export function resolveDeviceType(
  device: Device,
  readings: readonly SensorReading[],
  solarReadings: readonly SolarPcbReading[],
): Exclude<DeviceType, "auto"> {
  if (device.deviceType && device.deviceType !== "auto") return device.deviceType;
  if (/\bsolar\b/i.test(device.name)
    || solarReadings.some((reading) => reading.deviceId === device.goliothDeviceId)) {
    return "solar_pcb";
  }
  if (isNamedPhPcbDevice(device.name) || readings.some((reading) =>
    reading.deviceId === device.goliothDeviceId && ["ph", "cal", "mv"].includes(reading.sensorType))) {
    return "ph_pcb";
  }
  return "sensor";
}

export function buildDashboardHardware(
  readings: readonly SensorReading[],
  solarReadings: readonly SolarPcbReading[],
  devices: readonly Device[],
  now = Date.now(),
) {
  const visibleDevices = devices.filter((device) =>
    device.userId && device.dashboardVisible !== 0);
  const typedDevices = visibleDevices.map((device) => ({
    ...device, deviceType: resolveDeviceType(device, readings, solarReadings),
  }));
  const visibleIds = new Set(typedDevices.map((device) => device.goliothDeviceId));
  const solarIds = new Set(typedDevices
    .filter((device) => device.deviceType === "solar_pcb")
    .map((device) => device.goliothDeviceId));

  // Do not let history, unclaimed hardware, or old measurements create a card.
  // Each ordinary sensor card needs a recent reading of its own sensor type.
  const recentReadings = readings.filter((reading) =>
    reading.deviceId && visibleIds.has(reading.deviceId)
    && !solarIds.has(reading.deviceId)
    && hasRecentHardwareReport(reading.recordedAt, now));
  const phPcbs = groupPhPcbReadings(readings,
    typedDevices.filter((device) => device.deviceType === "ph_pcb"))
    .filter((group) => hasRecentHardwareReport(group.lastUpdated, now));
  const solarPcbs = groupSolarPcbReadings(solarReadings,
    typedDevices.filter((device) => device.deviceType === "solar_pcb"))
    .filter((group) => hasRecentHardwareReport(group.lastUpdated, now));
  return { readings: recentReadings, phPcbs, solarPcbs };
}
