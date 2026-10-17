import assert from "node:assert/strict";
import test from "node:test";
import type { Device, SensorReading, SolarPcbReading } from "@shared/schema";
import { hasRecentHistoryReport, historyRangeStart } from "@shared/history";
import { buildHistoryDevices, solarHistoryReadings } from "./history";

const now = Date.parse("2026-10-17T17:00:00Z");
const hour = 60 * 60 * 1000;
const device = (overrides: Partial<Device> = {}): Device => ({
  id: 1, userId: "owner", tankId: null, goliothDeviceId: "board",
  name: "My board", deviceType: "auto", dashboardVisible: 1, temperatureInputUnit: "unknown",
  lastSeenAt: new Date(now), createdAt: new Date(now - hour), ...overrides,
});
const reading = (overrides: Partial<SensorReading> = {}): SensorReading => ({
  id: 1, userId: "owner", deviceId: "board", sensorType: "temperature",
  value: 0, unit: "°F", recordedAt: new Date(now - hour), ...overrides,
});
const solar = (overrides: Partial<SolarPcbReading> = {}): SolarPcbReading => ({
  id: 1, userId: "owner", deviceId: "board",
  payload: { soc_pct: 0, vbus: false, charge: "IDLE", source: "BATTERY" },
  recordedAt: new Date(now - hour), ...overrides,
});

test("History's 24-hour boundary is inclusive and rejects invalid or future measurements", () => {
  assert.equal(hasRecentHistoryReport(new Date(now - 24 * hour), now), true);
  assert.equal(hasRecentHistoryReport(new Date(now - 24 * hour - 1), now), false);
  assert.equal(hasRecentHistoryReport(new Date(now + 1), now), false);
  assert.equal(hasRecentHistoryReport("invalid", now), false);
});

test("History accepts all existing chart windows independently of device eligibility", () => {
  for (const [range, hours] of [["60m", 1], ["6h", 6], ["12h", 12], ["24h", 24], ["7d", 168], ["30d", 720]] as const) {
    assert.equal(historyRangeStart(range, now)?.getTime(), now - hours * hour);
  }
  for (const range of ["invalid", "", "__proto__", "constructor"]) {
    assert.equal(historyRangeStart(range, now), null);
  }
});

test("History uses report time, not lastSeenAt, and does not show hardware without measurements", () => {
  assert.deepEqual(buildHistoryDevices("owner", [device()], [], [], now), []);
  assert.deepEqual(buildHistoryDevices("owner", [device()],
    [reading({ recordedAt: new Date(now - 25 * hour) })], [], now), []);
  assert.deepEqual(buildHistoryDevices("owner", [device()],
    [reading({ recordedAt: new Date(now + hour) })], [], now), []);
});

test("History includes a device offline for two hours and ignores the dashboard visibility switch", () => {
  const result = buildHistoryDevices("owner", [device({ dashboardVisible: 0 })],
    [reading({ recordedAt: new Date(now - 2 * hour) })], [], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].sensors[0].sensorType, "temperature");
});

test("released, other-owner and orphaned readings cannot expose History devices", () => {
  for (const userId of [null, "someone-else"]) {
    assert.deepEqual(buildHistoryDevices("owner", [device({ userId })], [reading()], [solar()], now), []);
  }
  assert.deepEqual(buildHistoryDevices("owner", [], [reading()], [solar()], now), []);
  assert.deepEqual(buildHistoryDevices("owner", [device()],
    [reading({ userId: "someone-else" })], [solar({ userId: "someone-else" })], now), []);
  assert.deepEqual(buildHistoryDevices("owner", [device()],
    [reading({ deviceId: null })], [solar({ deviceId: "other-board" })], now), []);
});

test("reading options stay separate by device and only include actual reported fields", () => {
  const result = buildHistoryDevices("owner",
    [device(), device({ id: 2, goliothDeviceId: "ph-board", name: "pH board" })],
    [reading(), reading({ deviceId: "ph-board", sensorType: "ph", unit: "pH" })], [], now);
  assert.deepEqual(result.find((item) => item.deviceId === "board")?.sensors.map((item) => item.sensorType), ["temperature"]);
  assert.deepEqual(result.find((item) => item.deviceId === "ph-board")?.sensors.map((item) => item.sensorType), ["ph"]);
  assert.equal(result[0].lastReportedAt, new Date(now - hour).toISOString());
});

test("older reading types remain selectable for an active device's longer history", () => {
  const result = buildHistoryDevices("owner", [device()], [
    reading(), reading({ sensorType: "ph", unit: "pH", recordedAt: new Date(now - 7 * 24 * hour) }),
  ], [], now);
  assert.equal(result[0].sensors.length, 2);
  assert.equal(result[0].lastReportedAt, new Date(now - hour).toISOString());
});

test("Solar-only boards qualify and retain numeric, text, false, and zero fields", () => {
  const [board] = buildHistoryDevices("owner", [device()], [], [solar()], now);
  assert.ok(board);
  assert.equal(board.sensors.length, 4);
  const battery = board.sensors.find((item) => item.sensorType === "soc_pct")!;
  assert.equal(battery.kind, "number");
  assert.equal(battery.unit, "%");
  const charge = board.sensors.find((item) => item.sensorType === "charge")!;
  assert.equal(charge.kind, "state");
  assert.equal(solarHistoryReadings([solar()], "board", battery)[0].value, 0);
  assert.equal(solarHistoryReadings([solar()], "board", charge)[0].value, "IDLE");
  const vbus = board.sensors.find((item) => item.sensorType === "vbus")!;
  assert.equal(solarHistoryReadings([solar()], "board", vbus)[0].value, false);
});

test("Solar history skips absent fields and other devices, preserving older selected-range readings", () => {
  const [board] = buildHistoryDevices("owner", [device()], [], [solar()], now);
  const sensor = board.sensors.find((item) => item.sensorType === "soc_pct")!;
  const result = solarHistoryReadings([
    solar({ id: 2, payload: { charge: "IDLE" } }),
    solar({ id: 3, deviceId: "other-board" }),
    solar({ id: 4, recordedAt: new Date(now - 20 * 24 * hour), payload: { soc_pct: 90 } }),
  ], "board", sensor);
  assert.equal(result.length, 1);
  assert.equal(result[0].value, 90);
  assert.equal(result[0].recordedAt, new Date(now - 20 * 24 * hour).toISOString());
});

test("expired hardware reappears when it reports again without changing stored settings", () => {
  const old = reading({ recordedAt: new Date(now - 25 * hour) });
  assert.equal(buildHistoryDevices("owner", [device()], [old], [], now).length, 0);
  assert.equal(buildHistoryDevices("owner", [device()], [old, reading()], [], now).length, 1);
});
