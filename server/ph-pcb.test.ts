import assert from "node:assert/strict";
import test from "node:test";
import {
  groupPhPcbReadings,
  isNamedPhPcbDevice,
  isPhPcbClassifierSensorType,
  isPhPcbSensorType,
  parseEventTimestamp,
  resolveTelemetryTimestamp,
} from "./ph-pcb";
import type { Device, SensorReading } from "@shared/schema";

let nextReadingId = 1;

const device = (goliothDeviceId: string, name: string): Device => ({
  id: Number(goliothDeviceId.slice(-2)),
  userId: "user-1",
  tankId: null,
  goliothDeviceId,
  name,
  lastSeenAt: null,
  createdAt: new Date("2026-08-30T12:00:00.000Z"),
});

const reading = (
  deviceId: string,
  sensorType: string,
  value: number,
  recordedAt: string,
): SensorReading => ({
  id: nextReadingId++,
  userId: "user-1",
  sensorType,
  value,
  unit: sensorType === "ph" ? "pH" : "°C",
  deviceId,
  recordedAt: new Date(recordedAt),
});

test("does not classify a temperature-only device as a pH PCB", () => {
  const deviceId = "temperature-device";
  const grouped = groupPhPcbReadings(
    [reading(deviceId, "temp_c", 25, "2026-08-30T12:00:00.000Z")],
    [device(deviceId, "Main temperature")],
  );

  assert.deepEqual(grouped, []);
  assert.equal(isPhPcbClassifierSensorType("temp_c"), false);
  assert.equal(isPhPcbSensorType("temp_c"), true);
});

test("keeps a named pH device visible with an explicit no-data group", () => {
  const grouped = groupPhPcbReadings(
    [],
    [device("ph-board-1", "pH PCB probe")],
  );

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].deviceName, "pH PCB probe");
  assert.deepEqual(grouped[0].readings, {});
  assert.equal(grouped[0].lastUpdated, null);
  assert.equal(isNamedPhPcbDevice("pH PCB probe"), true);
});

test("keeps the latest readings separate for multiple pH PCB devices", () => {
  const firstDevice = "ph-board-1";
  const secondDevice = "ph-board-2";
  const grouped = groupPhPcbReadings(
    [
      reading(firstDevice, "ph", 8.01, "2026-08-30T12:01:00.000Z"),
      reading(firstDevice, "ph", 8.12, "2026-08-30T12:02:00.000Z"),
      reading(secondDevice, "ph", 7.98, "2026-08-30T12:03:00.000Z"),
      reading(firstDevice, "temp_c", 25, "2026-08-30T12:04:00.000Z"),
    ],
    [
      device(firstDevice, "pH PCB A"),
      device(secondDevice, "pH PCB B"),
    ],
  );

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].readings.ph?.value, 8.12);
  assert.equal(grouped[1].readings.ph?.value, 7.98);
  assert.equal(grouped[0].readings.temp_c?.value, 25);
  assert.equal(grouped[0].lastUpdated?.toISOString(), "2026-08-30T12:04:00.000Z");
});

test("accepts nanosecond RFC3339 ce-time values at persisted Date precision", () => {
  const timestamp = parseEventTimestamp("2026-08-30T12:34:56.123456789Z");

  assert.ok(timestamp);
  assert.equal(timestamp.toISOString(), "2026-08-30T12:34:56.123Z");
});

test("requires authoritative ce-time for pH PCB telemetry", () => {
  const result = resolveTelemetryTimestamp({
    ceTime: undefined,
    legacyTimestamp: "2026-08-30T12:34:56.000Z",
    hasPhPcbTelemetry: true,
    now: new Date("2026-08-30T12:35:00.000Z"),
  });

  assert.deepEqual(result, {
    ok: false,
    message: "Event timestamp required for pH PCB telemetry",
  });
});

test("continues accepting timestamp-less unrelated legacy telemetry", () => {
  const now = new Date("2026-08-30T12:35:00.000Z");
  const result = resolveTelemetryTimestamp({
    ceTime: undefined,
    legacyTimestamp: undefined,
    hasPhPcbTelemetry: false,
    now,
  });

  assert.deepEqual(result, { ok: true, recordedAt: now });
});