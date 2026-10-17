import type { Device, SensorReading, SolarPcbReading } from "@shared/schema";
import { SOLAR_PCB_METRICS } from "@shared/schema";
import { hasRecentHistoryReport, type HistoryDevice, type HistoryReading, type HistorySensor } from "@shared/history";

const labels: Record<string, string> = {
  temperature: "Temperature", temp_c: "Water temperature", die_c: "Die temperature",
  ph: "pH level", cal: "Calibration", mv: "Sensor signal", chg: "Charge state",
  chg_stat: "Charge status", err: "Error code", ma: "Current draw", v: "Battery voltage",
  vbus: "VBUS", flow_rate_lpm: "Water flow", flow_liters: "Total flow",
  water_present: "Water detected", salinity: "Salinity", ammonia: "Ammonia",
  nitrite: "Nitrite", nitrate: "Nitrate", dissolved_oxygen: "Dissolved oxygen",
  aem: "AEM", aem_window: "AEM window", charge: "Charge state",
  ibat_ma: "Battery current", soc_pct: "Battery level", source: "Power source",
  usb_cc: "USB CC", vbat_mv: "Battery voltage", vbat_rise_mv: "Battery voltage rise",
};
const solarUnits: Record<string, string> = {
  ibat_ma: "mA", soc_pct: "%", vbat_mv: "mV", vbat_rise_mv: "mV",
};

// Only actual measurement timestamps qualify hardware, never webhook receipt/lastSeenAt.
// History is independent of dashboard visibility and never deletes older readings.
export function buildHistoryDevices(
  userId: string, devices: readonly Device[], readings: readonly SensorReading[],
  solarReadings: readonly SolarPcbReading[], now = Date.now(),
): HistoryDevice[] {
  return devices.filter((device) => device.userId === userId).flatMap((device) => {
    const numeric = readings.filter((reading) =>
      reading.userId === userId && reading.deviceId === device.goliothDeviceId
      && new Date(reading.recordedAt).getTime() <= now);
    const solar = solarReadings.filter((reading) =>
      reading.userId === userId && reading.deviceId === device.goliothDeviceId
      && new Date(reading.recordedAt).getTime() <= now);
    const lastReported = [...numeric, ...solar].reduce((latest, reading) =>
      Math.max(latest, new Date(reading.recordedAt).getTime()), -Infinity);
    if (!hasRecentHistoryReport(new Date(lastReported), now)) return [];
    const sensors = new Map<string, HistorySensor>();
    for (const reading of numeric) {
      if (!Number.isFinite(reading.value)) continue;
      sensors.set(reading.sensorType, {
        sensorType: reading.sensorType, label: labels[reading.sensorType] ?? reading.sensorType,
        unit: reading.unit, kind: "number", source: "sensor",
      });
    }
    for (const reading of solar) {
      for (const key of SOLAR_PCB_METRICS) {
        const value = reading.payload[key];
        if (value === undefined || value === null) continue;
        sensors.set(key, {
          sensorType: key, label: labels[key] ?? key, unit: solarUnits[key] ?? "",
          kind: typeof value === "number" ? "number" : "state", source: "solar",
        });
      }
    }
    return [{
      deviceId: device.goliothDeviceId, name: device.name,
      lastReportedAt: new Date(lastReported).toISOString(),
      sensors: Array.from(sensors.values()).sort((a, b) => a.label.localeCompare(b.label)),
    }];
  }).sort((a, b) => a.name.localeCompare(b.name) || a.deviceId.localeCompare(b.deviceId));
}

export function solarHistoryReadings(
  readings: readonly SolarPcbReading[], deviceId: string, sensor: HistorySensor,
): HistoryReading[] {
  return readings.filter((reading) => reading.deviceId === deviceId).flatMap((reading) => {
    const value = reading.payload[sensor.sensorType as keyof typeof reading.payload];
    if (value === undefined || value === null) return [];
    return [{
      id: `solar:${reading.id}`, deviceId, sensorType: sensor.sensorType,
      value, unit: sensor.unit, recordedAt: new Date(reading.recordedAt).toISOString(),
    }];
  });
}
