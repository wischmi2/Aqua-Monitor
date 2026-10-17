import assert from "node:assert/strict";
import test from "node:test";
import type { Device, SensorReading, SolarPcbReading } from "@shared/schema";
import { buildDashboardHardware, resolveDeviceType } from "./dashboard-hardware";
import { hasRecentHardwareReport, isDeviceType } from "@shared/device-types";

const now = Date.parse("2026-10-17T17:00:00Z");
const recent = new Date(now - 30 * 60 * 1000);
const old = new Date(now - 60 * 60 * 1000 - 1);
const device = (overrides: Partial<Device> = {}): Device => ({
  id: 1, userId: "owner", tankId: null, goliothDeviceId: "board",
  name: "Device board", deviceType: "auto", dashboardVisible: 1, temperatureInputUnit: "unknown",
  lastSeenAt: new Date(now), createdAt: recent, ...overrides,
});
const reading = (overrides: Partial<SensorReading> = {}): SensorReading => ({
  id: 1, userId: "owner", deviceId: "board", sensorType: "temperature",
  value: 0, unit: "°F", recordedAt: recent, ...overrides,
});
const solar = (overrides: Partial<SolarPcbReading> = {}): SolarPcbReading => ({
  id: 1, userId: "owner", deviceId: "board",
  payload: { soc_pct: 0, vbus: false }, recordedAt: recent, ...overrides,
});

test("one-hour reporting window includes exactly one hour and excludes old or invalid timestamps", () => {
  assert.equal(hasRecentHardwareReport(new Date(now - 3600000), now), true);
  assert.equal(hasRecentHardwareReport(old, now), false);
  assert.equal(hasRecentHardwareReport(undefined, now), false);
  assert.equal(hasRecentHardwareReport("invalid", now), false);
  assert.equal(hasRecentHardwareReport(new Date(now + 3600000), now), false);
});

test("device type validates allowed values and explicit choices override names and history", () => {
  for (const value of ["auto", "ph_pcb", "solar_pcb", "sensor"]) {
    assert.equal(isDeviceType(value), true);
  }
  for (const value of ["ph", "", null, 1, {}, "invalid"]) {
    assert.equal(isDeviceType(value), false);
  }
  assert.equal(resolveDeviceType(device({ deviceType: "sensor", name: "pH solar PCB" }),
    [reading({ sensorType: "ph" })], [solar()]), "sensor");
  assert.equal(resolveDeviceType(device({ deviceType: "ph_pcb", name: "Solar PCB" }),
    [], [solar()]), "ph_pcb");
  assert.equal(resolveDeviceType(device({ deviceType: "solar_pcb", name: "pH PCB" }),
    [reading({ sensorType: "ph" })], []), "solar_pcb");
});

test("automatic detection still distinguishes pH, Solar, and ordinary sensors", () => {
  assert.equal(resolveDeviceType(device(), [reading({ sensorType: "ph" })], []), "ph_pcb");
  assert.equal(resolveDeviceType(device(), [], [solar()]), "solar_pcb");
  assert.equal(resolveDeviceType(device(), [reading({ sensorType: "vbus" })], []), "sensor");
});

test("no hardware or old readings means no dashboard cards, even with recent receipt time", () => {
  assert.deepEqual(buildDashboardHardware([], [], [device({ name: "pH PCB" })], now),
    { readings: [], phPcbs: [], solarPcbs: [] });
  const result = buildDashboardHardware(
    [reading({ recordedAt: old, sensorType: "ph" })],
    [solar({ recordedAt: old })], [device()], now);
  assert.deepEqual(result, { readings: [], phPcbs: [], solarPcbs: [] });
});

test("hidden, released, missing-ID, and unclaimed devices cannot create any cards", () => {
  for (const devices of [[], [device({ userId: null })], [device({ dashboardVisible: 0 })]]) {
    assert.deepEqual(buildDashboardHardware([reading({ sensorType: "ph" })], [solar()], devices, now),
      { readings: [], phPcbs: [], solarPcbs: [] });
  }
  assert.deepEqual(buildDashboardHardware([reading({ deviceId: null })], [], [device()], now).readings, []);
});

test("fresh zero-valued ordinary sensors remain visible while expired sensor types are excluded", () => {
  const result = buildDashboardHardware([
    reading({ sensorType: "water_present", value: 0 }),
    reading({ sensorType: "salinity", recordedAt: old }),
  ], [], [device()], now);
  assert.equal(result.readings.length, 1);
  assert.equal(result.readings[0].value, 0);
});

test("pH and Solar cards respect explicit types and expire after an hour", () => {
  const phDevice = device({ deviceType: "ph_pcb" });
  const phResult = buildDashboardHardware([reading({ sensorType: "vbus" })], [], [phDevice], now);
  assert.equal(phResult.phPcbs.length, 1);
  assert.equal(phResult.solarPcbs.length, 0);
  assert.equal(buildDashboardHardware([reading({ sensorType: "vbus", recordedAt: old })],
    [], [phDevice], now).phPcbs.length, 0);
  const solarDevice = device({ deviceType: "solar_pcb" });
  const solarResult = buildDashboardHardware([reading({ sensorType: "ph" })], [solar()],
    [solarDevice], now);
  assert.equal(solarResult.solarPcbs.length, 1);
  assert.equal(solarResult.phPcbs.length, 0);
  assert.equal(solarResult.readings.length, 0);
  assert.equal(solarResult.solarPcbs[0].readings.soc_pct?.value, 0);
  assert.equal(buildDashboardHardware([], [solar({ recordedAt: old })],
    [solarDevice], now).solarPcbs.length, 0);
});

test("hardware reappears after sending a new report without changing saved settings", () => {
  const d = device({ deviceType: "solar_pcb" });
  assert.equal(buildDashboardHardware([], [solar({ recordedAt: old })], [d], now).solarPcbs.length, 0);
  assert.equal(buildDashboardHardware([], [solar({ recordedAt: old }), solar()], [d], now).solarPcbs.length, 1);
});
