import assert from "node:assert/strict";
import test from "node:test";
import {
  convertTemperatureForDisplay,
  isTemperatureChannel,
  isTemperatureDisplayUnit,
} from "@shared/temperature";

test("display conversions support Celsius and Fahrenheit in both directions", () => {
  assert.ok(Math.abs(convertTemperatureForDisplay(21.94, "°C", "°F")! - 71.492) < 1e-10);
  assert.ok(Math.abs(convertTemperatureForDisplay(71.492, "°F", "°C")! - 21.94) < 1e-10);
  assert.equal(convertTemperatureForDisplay(0, "°C", "°F"), 32);
  assert.equal(convertTemperatureForDisplay(32, "°F", "°C"), 0);
  assert.equal(convertTemperatureForDisplay(-40, "°F", "°C"), -40);
  assert.equal(convertTemperatureForDisplay(21.94, "°C", "°C"), 21.94);
});

test("display preferences never infer unknown source units or fabricate invalid values", () => {
  for (const source of ["unknown", "", "K", "celsius"]) {
    assert.equal(convertTemperatureForDisplay(22, source, "°C"), null);
    assert.equal(convertTemperatureForDisplay(22, source, "°F"), null);
  }
  assert.equal(convertTemperatureForDisplay(NaN, "°C", "°F"), null);
  assert.equal(convertTemperatureForDisplay(Infinity, "°C", "°F"), null);
  assert.equal(isTemperatureDisplayUnit("°C"), true);
  assert.equal(isTemperatureDisplayUnit("°F"), true);
  for (const input of ["unknown", "fahrenheit", null, 0, {}]) {
    assert.equal(isTemperatureDisplayUnit(input), false);
  }
});

test("display selection applies to all temperature channels but not unrelated sensors", () => {
  for (const sensor of ["temperature", "temp_c", "die_c"]) assert.equal(isTemperatureChannel(sensor), true);
  for (const sensor of ["ph", "v", "flow_rate_lpm", "soc_pct"]) assert.equal(isTemperatureChannel(sensor), false);
});
