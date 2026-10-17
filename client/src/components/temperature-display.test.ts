import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { displayTemperature, temperatureStatus } from "../lib/temperature-display";
import { readTemperatureDisplayPreference, selectTemperatureUnit, useTemperatureUnit } from "../hooks/use-temperature-unit";
import { PhPcbMetricRow } from "./sensor-card";
import { TemperatureUnitControl } from "./temperature-unit-control";
import type { SensorReading } from "@shared/schema";

const row: SensorReading = {
  id: 1, userId: "owner", deviceId: "pcb", sensorType: "temp_c",
  value: 25, unit: "°C", recordedAt: new Date(),
};

test("display conversion is bidirectional and never mutates or guesses source units", () => {
  assert.deepEqual(displayTemperature(77, "°F", "°C"), { value: 25, unit: "°C" });
  assert.deepEqual(displayTemperature(25, "°C", "°F"), { value: 77, unit: "°F" });
  assert.deepEqual(displayTemperature(0, "°C", "°F"), { value: 32, unit: "°F" });
  for (const unit of ["unknown", ""]) {
    assert.deepEqual(displayTemperature(22, unit, "°F"), { value: 22, unit: "Unit unknown" });
  }
});

test("status uses canonical Fahrenheit boundaries, independent of display preference", () => {
  for (const [fahrenheit, status] of [
    [73, "critical"], [74, "warning"], [75, "warning"], [76, "normal"],
    [82, "normal"], [83, "warning"], [84, "warning"], [85, "critical"],
  ] as const) {
    assert.equal(temperatureStatus(fahrenheit, "°F"), status);
    assert.equal(temperatureStatus((fahrenheit - 32) * 5 / 9, "°C"), status);
  }
  assert.equal(temperatureStatus(22, "unknown"), "unknown");
  assert.equal(temperatureStatus(NaN, "°F"), "unknown");
});

test("PCB water and die temperatures use the same display unit without changing stored readings", () => {
  for (const key of ["temp_c", "die_c"] as const) {
    const reading = { ...row, sensorType: key };
    const props = { definition: { key, label: "Temperature", unit: "°C", section: "ph" as const }, reading };
    const fahrenheit = renderToStaticMarkup(createElement(PhPcbMetricRow, { ...props, temperatureUnit: "°F" }));
    assert.match(fahrenheit, /77\.0/);
    assert.match(fahrenheit, /°F/);
    const celsius = renderToStaticMarkup(createElement(PhPcbMetricRow, { ...props, temperatureUnit: "°C" }));
    assert.match(celsius, /25\.0/);
    assert.match(celsius, /°C/);
    const unknown = renderToStaticMarkup(createElement(PhPcbMetricRow, {
      ...props, reading: { ...reading, unit: "unknown" }, temperatureUnit: "°F",
    }));
    assert.match(unknown, /25\.0/);
    assert.match(unknown, /Unit unknown/);
    assert.doesNotMatch(unknown, /°F|°C/);
    assert.equal(reading.value, 25);
    assert.equal(reading.unit, "°C");
  }
});

test("PCB missing and non-temperature readings retain their original behavior", () => {
  const definition = { key: "temp_c" as const, label: "Temperature", unit: "°C", section: "ph" as const };
  const missing = renderToStaticMarkup(createElement(PhPcbMetricRow, { definition, temperatureUnit: "°F" }));
  assert.match(missing, /Not reported/);
  assert.doesNotMatch(missing, /°F|°C/);
  const voltage = renderToStaticMarkup(createElement(PhPcbMetricRow, {
    definition: { key: "v", label: "Voltage", unit: "V", section: "health" },
    reading: { ...row, value: 3.7, unit: "V" }, temperatureUnit: "°F",
  }));
  assert.match(voltage, /3\.7/);
  assert.doesNotMatch(voltage, /°F/);
});

test("all temperature consumers share the existing browser key and ignore invalid preferences", () => {
  let saved: string | null = "invalid";
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => key === "historyTemperatureDisplayUnit" ? saved : null,
      setItem: (key: string, value: string) => {
        assert.equal(key, "historyTemperatureDisplayUnit");
        saved = value;
      },
    },
  });
  function Consumers() {
    const dashboard = useTemperatureUnit();
    const pcb = useTemperatureUnit();
    return createElement("div", null, `${dashboard.unit} / ${pcb.unit}`);
  }
  assert.equal(readTemperatureDisplayPreference(), null);
  assert.match(renderToStaticMarkup(createElement(Consumers)), /°F \/ °F/);
  for (const unit of ["°C", "°F"] as const) {
    selectTemperatureUnit(unit);
    assert.equal(readTemperatureDisplayPreference(), unit);
    assert.match(renderToStaticMarkup(createElement(Consumers)), new RegExp(`${unit} / ${unit}`));
    const html = renderToStaticMarkup(createElement(TemperatureUnitControl, {
      unit, onChange: selectTemperatureUnit, testId: "test",
    }));
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /Display temperature in Celsius/);
    assert.match(html, /Display temperature in Fahrenheit/);
  }
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("blocked"); } });
  assert.doesNotThrow(() => selectTemperatureUnit("°C"));
  assert.equal(readTemperatureDisplayPreference(), null);
  delete (globalThis as { localStorage?: unknown }).localStorage;
});
