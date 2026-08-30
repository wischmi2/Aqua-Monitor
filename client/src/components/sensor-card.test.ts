import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPcbMetricValue,
  getPcbStatus,
  isReadingStale,
} from "./sensor-card";
import type { SensorReading } from "@shared/schema";

const reading = (
  value: number,
  recordedAt: string,
): SensorReading => ({
  id: 1,
  userId: "user-1",
  sensorType: "ph",
  value,
  unit: "pH",
  deviceId: "ph-board-1",
  recordedAt: new Date(recordedAt),
});

test("keeps missing pH PCB fields visibly marked as not reported", () => {
  assert.equal(formatPcbMetricValue("mv"), "Not reported");
  assert.equal(getPcbStatus(), "no-data");
});

test("keeps stale pH PCB fields visibly marked as delayed", () => {
  const oldReading = reading(8.2, "2026-08-30T12:00:00.000Z");
  const now = new Date("2026-08-30T12:06:00.000Z").getTime();

  assert.equal(isReadingStale(oldReading, now), true);
  assert.equal(getPcbStatus(oldReading, now), "delayed");
});