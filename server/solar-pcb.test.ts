import assert from "node:assert/strict";
import test from "node:test";
import { extractSolarPcbPayload, groupSolarPcbReadings, hasSolarPcbTelemetry } from "./solar-pcb";
import { resolveTelemetryTimestamp } from "./ph-pcb";
import type { Device, SolarPcbReading } from "@shared/schema";

const sample = {
  aem: false, aem_window: "AEM-BLOCKED", charge: "IDLE", ibat_ma: 0,
  soc_pct: 95, source: "BATTERY", usb_cc: false, vbat_mv: 4155,
  vbat_rise_mv: 0, vbus: false,
};
const device: Device = {
  id: 1, userId: "owner", tankId: null, goliothDeviceId: "solar-device",
  name: "Solar PCB", dashboardVisible: 1, lastSeenAt: null, createdAt: new Date(),
};
const event: SolarPcbReading = {
  id: 1, userId: "owner", deviceId: device.goliothDeviceId,
  payload: sample, recordedAt: new Date("2026-10-17T12:00:00Z"),
};

test("extracts all ten solar fields without losing strings, false or zero", () => {
  for (const payload of [sample, { data: sample }, { data: { value: sample } },
    { value: sample }, { data: { data: sample } }]) {
    assert.deepEqual(extractSolarPcbPayload(payload), sample);
  }
  assert.equal(hasSolarPcbTelemetry(sample), true);
  assert.equal(hasSolarPcbTelemetry({ vbus: false }), false);
});

test("rejects invalid solar field types instead of coercing or inventing values", () => {
  assert.deepEqual(extractSolarPcbPayload({
    soc_pct: "95", source: 0, charge: "", vbat_mv: NaN,
    usb_cc: "false", vbus: false, ibat_ma: -74,
  }), { vbus: false, ibat_ma: -74 });
});

test("groups solar telemetry by claimed visible devices and preserves newest field values", () => {
  const older = { ...event, id: 2, payload: { soc_pct: 93, vbat_rise_mv: -10 },
    recordedAt: new Date("2026-10-17T11:00:00Z") };
  const [group] = groupSolarPcbReadings([event, older], [device]);
  assert.equal(group.readings.soc_pct?.value, 95);
  assert.equal(group.readings.aem?.value, false);
  assert.equal(group.readings.ibat_ma?.value, 0);
  assert.equal(group.readings.vbat_rise_mv?.value, 0);
  assert.equal(group.lastUpdated?.toISOString(), event.recordedAt.toISOString());
});

test("hidden, released, and other devices cannot be restored by solar history", () => {
  assert.deepEqual(groupSolarPcbReadings([event], []), []);
  assert.deepEqual(groupSolarPcbReadings([event], [{ ...device, dashboardVisible: 0 }]), []);
  assert.deepEqual(groupSolarPcbReadings([event], [{ ...device, userId: null }]), []);
  assert.deepEqual(groupSolarPcbReadings([event], [{ ...device, goliothDeviceId: "other", name: "Temperature" }]), []);
});

test("a named solar board can show an honest no-data card before its first reading", () => {
  const [group] = groupSolarPcbReadings([], [device]);
  assert.deepEqual(group.readings, {});
  assert.equal(group.lastUpdated, null);
});

test("solar telemetry requires an authoritative event timestamp", () => {
  assert.deepEqual(resolveTelemetryTimestamp({
    ceTime: undefined, legacyTimestamp: "2026-10-17T12:00:00Z",
    hasPhPcbTelemetry: false, hasSolarPcbTelemetry: true,
  }), { ok: false, message: "Event timestamp required for Solar PCB telemetry" });
});
