import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { HistoryDevice, HistoryReading } from "@shared/history";
import History from "../pages/history";

Object.defineProperty(globalThis, "localStorage", { value: { getItem: () => null }, configurable: true });

const recent = new Date(Date.now() - 60_000).toISOString();
const device = (overrides: Partial<HistoryDevice> = {}): HistoryDevice => ({
  deviceId: "board-a", name: "Aquarium board", lastReportedAt: recent,
  sensors: [{ sensorType: "temperature", label: "Temperature", unit: "°F", kind: "number", source: "sensor" }],
  ...overrides,
});
const reading = (overrides: Partial<HistoryReading> = {}): HistoryReading => ({
  id: "sensor:1", deviceId: "board-a", sensorType: "temperature", value: 78,
  unit: "°F", recordedAt: recent, ...overrides,
});

function render(devices: HistoryDevice[], readings: HistoryReading[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["/api/sensors/history/devices"], devices);
  const selected = devices[0];
  if (selected) {
    client.setQueryData(["/api/sensors/history", selected.deviceId, selected.sensors[0]?.sensorType ?? "", "24h"], readings);
  }
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(History)));
  } finally {
    client.clear();
  }
}

test("History renders a truthful empty state for no devices or expired hardware", () => {
  assert.match(render([]), /history-no-active-devices/);
  const html = render([device({ lastReportedAt: new Date(Date.now() - 25 * 3600_000).toISOString() })], [reading()]);
  assert.match(html, /history-no-active-devices/);
  assert.doesNotMatch(html, /history-numeric-chart/);
});

test("History shows selected hardware identity and numeric readings without other-device contamination", () => {
  const html = render([device()], [reading(), reading({ id: "sensor:2", deviceId: "board-b", value: 99999 })]);
  assert.match(html, /select-history-device/);
  assert.match(html, /select-history-sensor/);
  assert.match(html, /Aquarium board/);
  assert.match(html, /board-a/);
  assert.match(html, /history-numeric-chart/);
  assert.match(html, /78.00/);
  assert.doesNotMatch(html, /99999/);
  for (const range of ["60m", "6h", "12h", "24h", "7d", "30d"]) {
    assert.match(html, new RegExp(`tab-${range}`));
  }
});

test("History shows reported text and false states as events rather than fabricated numeric charts", () => {
  const board = device({ sensors: [{ sensorType: "charge", label: "Charge state", unit: "", kind: "state", source: "solar" }] });
  const html = render([board], [
    reading({ sensorType: "charge", value: "IDLE" }),
    reading({ id: "solar:2", sensorType: "charge", value: false }),
  ]);
  assert.match(html, /history-state-events/);
  assert.match(html, /IDLE/);
  assert.match(html, /False/);
  assert.doesNotMatch(html, /history-numeric-chart/);
});

test("History retains zero and applies the same converted flow units in the recent readings list", () => {
  const board = device({ sensors: [{ sensorType: "flow_liters", label: "Total flow", unit: "L", kind: "number", source: "sensor" }] });
  const html = render([board], [
    reading({ sensorType: "flow_liters", value: 10, unit: "L" }),
    reading({ id: "sensor:2", sensorType: "flow_liters", value: 0, unit: "L" }),
  ]);
  assert.match(html, /2.64/);
  assert.match(html, /0.00/);
  assert.match(html, /gal/);
});

test("History distinguishes active hardware with no measurements in the selected range", () => {
  const html = render([device()], []);
  assert.match(html, /history-no-data/);
  assert.doesNotMatch(html, /history-no-active-devices/);
});

test("History displays unknown temperature units honestly without a Fahrenheit label", () => {
  const html = render([device({ sensors: [{ sensorType: "temperature", label: "Temperature", unit: "unknown", kind: "number", source: "sensor" }] })],
    [reading({ value: 22, unit: "unknown" })]);
  assert.match(html, /22.00/);
  assert.match(html, /Unit unknown/);
  assert.doesNotMatch(html, /°F/);
});

test("History never merges known and unknown temperature units into one chart", () => {
  const html = render([device()], [
    reading({ value: 22, unit: "unknown" }),
    reading({ id: "sensor:2", value: 78, unit: "°F" }),
  ]);
  assert.match(html, /history-mixed-temperature-units/);
  assert.match(html, /Unit unknown/);
  assert.match(html, /78 °F/);
  assert.doesNotMatch(html, /history-numeric-chart/);
});

test("History normalizes labeled Celsius without rewriting or reinterpreting old Fahrenheit readings", () => {
  const rows = [reading({ value: 22, unit: "°F" }), reading({ id: "sensor:2", value: 22, unit: "°C" })];
  const html = render([device()], rows);
  assert.match(html, /history-numeric-chart/);
  assert.match(html, /71.60/);
  assert.match(html, /22.00/);
  assert.equal(rows[1].value, 22);
  assert.equal(rows[1].unit, "°C");
});
