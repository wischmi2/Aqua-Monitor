import assert from "node:assert/strict";
import test from "node:test";
import { extractTemperature, canCheckTemperatureAlert, temperatureInputUnitSchema } from "@shared/temperature";
import { normalizeHistoryReading, type HistoryReading } from "@shared/history";

const wrappers = [
  (data: object) => data,
  (data: object) => ({ data }),
  (value: object) => ({ data: { value } }),
  (value: object) => ({ value }),
  (data: object) => ({ data: { data } }),
];

test("all generic aliases require an explicit device input unit in every supported envelope", () => {
  for (const field of ["temp", "temperature", "Temperature", "TEMP"]) {
    for (const wrap of wrappers) {
      const payload = wrap({ [field]: 22 });
      assert.deepEqual(extractTemperature(payload), { value: 22, unit: "unknown" });
      assert.deepEqual(extractTemperature(payload, "unknown"), { value: 22, unit: "unknown" });
      assert.deepEqual(extractTemperature(payload, "celsius"), { value: 71.6, unit: "°F" });
      assert.deepEqual(extractTemperature(payload, "fahrenheit"), { value: 22, unit: "°F" });
    }
  }
});

test("explicit Celsius and Fahrenheit fields override conflicting device configuration", () => {
  for (const wrap of wrappers) {
    for (const field of ["temp_c", "tempC", "temp_celsius"]) {
      assert.deepEqual(extractTemperature(wrap({ [field]: 22 }), "fahrenheit"), { value: 71.6, unit: "°F" });
    }
    for (const field of ["temp_f", "tempF", "temp_fahrenheit"]) {
      assert.deepEqual(extractTemperature(wrap({ [field]: 72 }), "celsius"), { value: 72, unit: "°F" });
    }
  }
  assert.deepEqual(extractTemperature({ temp: 99, data: { value: { temp_c: 22 } } }, "fahrenheit"), { value: 71.6, unit: "°F" });
});

test("temperature parsing keeps zero and negative values, but rejects non-numeric and non-finite data", () => {
  assert.deepEqual(extractTemperature({ temp: 0 }, "celsius"), { value: 32, unit: "°F" });
  assert.deepEqual(extractTemperature({ temp_c: -40 }), { value: -40, unit: "°F" });
  for (const value of [null, undefined, true, false, "22", Infinity, -Infinity, NaN, {}]) {
    assert.equal(extractTemperature({ temp: value }), undefined);
  }
  assert.equal(extractTemperature({}), undefined);
});

test("settings reject unsupported unit values and unknown units cannot trigger Fahrenheit alerts", () => {
  for (const unit of ["unknown", "celsius", "fahrenheit"]) assert.ok(temperatureInputUnitSchema.safeParse(unit).success);
  for (const unit of ["C", "F", "kelvin", null, 0, {}]) assert.ok(!temperatureInputUnitSchema.safeParse(unit).success);
  assert.equal(canCheckTemperatureAlert("temperature", "unknown"), false);
  assert.equal(canCheckTemperatureAlert("temperature", ""), false);
  assert.equal(canCheckTemperatureAlert("temperature", "°C"), false);
  assert.equal(canCheckTemperatureAlert("temperature", "°F"), true);
  assert.equal(canCheckTemperatureAlert("ph", "pH"), true);
});

test("shared temperature history uses stored labels without changing legacy values or PCB Celsius history", () => {
  const row: HistoryReading = {
    id: "sensor:1", deviceId: "board", sensorType: "temperature",
    value: 22, unit: "°F", recordedAt: new Date().toISOString(),
  };
  assert.deepEqual(normalizeHistoryReading(row), row); // No guessing that legacy 22°F was Celsius.
  assert.deepEqual(normalizeHistoryReading({ ...row, unit: "°C" }), { ...row, value: 71.6 });
  assert.deepEqual(normalizeHistoryReading({ ...row, unit: "" }), { ...row, unit: "unknown" });
  assert.deepEqual(normalizeHistoryReading({ ...row, unit: "unknown" }), { ...row, unit: "unknown" });
  const pcb = { ...row, sensorType: "temp_c", unit: "°C" };
  assert.equal(normalizeHistoryReading(pcb), pcb);
  assert.equal(row.value, 22);
  assert.equal(row.unit, "°F");
});
