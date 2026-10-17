import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Device, SensorReading, UserSettings } from "@shared/schema";
import Dashboard from "../pages/dashboard";
import { PhPcbTemperatureControl } from "./sensor-card";

Object.defineProperty(globalThis, "localStorage", { value: { getItem: () => null }, configurable: true });
const now = Date.now();
const device = (id: string): Device => ({
  id: id === "board-a" ? 1 : 2, userId: "owner", tankId: null,
  goliothDeviceId: id, name: id === "board-a" ? "Water probe" : "Other probe",
  dashboardVisible: 1, deviceType: "sensor", temperatureInputUnit: "unknown",
  lastSeenAt: new Date(now), createdAt: new Date(now),
});
const reading = (id: string, value: number, time = now): SensorReading => ({
  id: id === "board-a" ? 1 : 2, userId: "owner", deviceId: id, sensorType: "temperature",
  unit: "°F", value, recordedAt: new Date(time),
});

function render(source: string | null | undefined, readings: SensorReading[], devices = [device("board-a"), device("board-b")]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["/api/sensors/latest"], readings);
  client.setQueryData(["/api/devices"], devices);
  client.setQueryData(["/api/sensors/ph-pcbs"], []);
  client.setQueryData(["/api/sensors/solar-pcbs"], []);
  client.setQueryData(["/api/equipment"], []);
  if (source !== undefined) {
    const settings: UserSettings = {
      id: 1, userId: "owner", phoneNumber: null, alertsEnabled: 1, alertCooldownMinutes: 30,
      temperatureSourceDeviceId: source, temperatureDisplayUnit: null, createdAt: new Date(now), updatedAt: new Date(now),
    };
    client.setQueryData(["/api/user-settings"], settings);
  }
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Dashboard)));
  } finally {
    client.clear();
  }
}

test("Temperature card uses the saved source, not a newer reading from another board", () => {
  const html = render("board-a", [reading("board-a", 76, now - 10_000), reading("board-b", 80)]);
  assert.match(html, /sensor-temperature-value">76.0</);
  assert.doesNotMatch(html, /sensor-temperature-value">80.0</);
  assert.match(html, /Source: Water probe/);
  assert.match(html, /Device ID: board-a/);
  assert.match(html, /select-temperature-source/);
  assert.match(html, /value="board-a" selected/);
});

test("Automatic remains available and shows the latest eligible temperature", () => {
  const html = render(null, [reading("board-a", 76, now - 10_000), reading("board-b", 80)]);
  assert.match(html, /sensor-temperature-value">80.0</);
  assert.match(html, /Source: Other probe/);
  assert.match(html, /Automatic/);
});

test("an offline saved device has a recovery selector but no substituted measurement card", () => {
  const html = render("board-a", [reading("board-b", 80)]);
  assert.match(html, /temperature-source-recovery/);
  assert.match(html, /Unavailable/);
  assert.match(html, /value="board-a" selected/);
  assert.doesNotMatch(html, /sensor-temperature-value/);
});

test("hidden hardware cannot supply the pinned card, but its saved choice can be changed", () => {
  const hidden = { ...device("board-a"), dashboardVisible: 0 };
  const html = render("board-a", [reading("board-a", 76), reading("board-b", 80)], [hidden, device("board-b")]);
  assert.match(html, /temperature-source-recovery/);
  assert.match(html, /Unavailable/);
  assert.doesNotMatch(html, /sensor-temperature-value/);
});

test("the card does not assume Automatic while saved settings are loading", () => {
  const html = render(undefined, [reading("board-b", 80)]);
  assert.match(html, /Loading saved temperature source/);
  assert.doesNotMatch(html, /sensor-temperature-value/);
});

test("a selected source's zero temperature remains a real visible measurement", () => {
  const html = render("board-a", [reading("board-a", 0)]);
  assert.match(html, /sensor-temperature-value">0.0</);
});

test("Dashboard and PCB controls select the same default when there is no saved browser preference", () => {
  const dashboard = render("board-a", [reading("board-a", 77)]);
  const pcb = renderToStaticMarkup(createElement(PhPcbTemperatureControl, { deviceId: "pcb" }));
  for (const [html, prefix] of [[dashboard, "dashboard"], [pcb, "ph-pcb-pcb"]]) {
    assert.match(html, new RegExp(`button-${prefix}-temperature-fahrenheit" aria-pressed="true"`));
    assert.match(html, new RegExp(`button-${prefix}-temperature-celsius" aria-pressed="false"`));
  }
});

test("Dashboard display selection converts only the pinned reading and keeps its canonical status", () => {
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: (key: string) => key === "historyTemperatureDisplayUnit" ? "°C" : null },
    configurable: true,
  });
  const rows = [reading("board-a", 77, now - 10_000), reading("board-b", 85)];
  const html = render("board-a", rows);
  assert.match(html, /sensor-temperature-value">25.0</);
  assert.match(html, /Status: normal/);
  assert.match(html, /Source: Water probe/);
  assert.match(html, /button-dashboard-temperature-celsius/);
  assert.equal(rows[0].value, 77);
  assert.equal(rows[0].unit, "°F");
  const unknown = render("board-a", [{ ...rows[0], unit: "unknown", value: 22 }]);
  assert.match(unknown, /sensor-temperature-value">22.0</);
  assert.match(unknown, /Unit unknown/);
  assert.match(unknown, /Status: unknown/);
  assert.doesNotMatch(unknown, /button-dashboard-temperature-celsius/);
  Object.defineProperty(globalThis, "localStorage", { value: { getItem: () => null }, configurable: true });
});
