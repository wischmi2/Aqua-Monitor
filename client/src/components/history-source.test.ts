import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { HistoryDevice, HistoryReading } from "@shared/history";
import type { Device, SensorReading } from "@shared/schema";
import { HistoryBrowser as History } from "../pages/history";

Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: () => null }, configurable: true,
});

const now = Date.now();
const recent = new Date(now - 60_000).toISOString();
function historyBoard(deviceId: string, overrides: Partial<HistoryDevice> = {}): HistoryDevice {
  return {
    deviceId, name: `Tank ${deviceId}`, lastReportedAt: recent,
    sensors: [{ sensorType: "temperature", label: "Temperature", unit: "°F", kind: "number", source: "sensor" }],
    ...overrides,
  };
}
function hardware(deviceId: string, overrides: Partial<Device> = {}): Device {
  return {
    id: 1, goliothDeviceId: deviceId, name: `Tank ${deviceId}`, userId: "owner",
    dashboardVisible: 1, deviceType: "sensor", temperatureInputUnit: "fahrenheit",
    tankId: null, createdAt: new Date(now), lastSeenAt: new Date(now), ...overrides,
  };
}
function live(deviceId: string, overrides: Partial<SensorReading> = {}): SensorReading {
  return {
    id: 1, userId: "owner", deviceId, sensorType: "temperature", value: 78,
    unit: "°F", recordedAt: new Date(recent), ...overrides,
  };
}
function row(deviceId: string, value: number): HistoryReading {
  return { id: `sensor:${deviceId}`, deviceId, sensorType: "temperature", value, unit: "°F", recordedAt: recent };
}

function render(options: {
  pin: string | null;
  boards?: HistoryDevice[];
  devices?: Device[];
  latest?: SensorReading[];
  rows?: HistoryReading[];
  missingSettings?: boolean;
  settingsError?: boolean;
  manual?: boolean;
}) {
  const boards = options.boards ?? [historyBoard("a"), historyBoard("b")];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["/api/sensors/history/devices"], boards);
  client.setQueryData(["/api/devices"], options.devices ?? [hardware("a"), hardware("b")]);
  client.setQueryData(["/api/sensors/latest"], options.latest ?? [live("a"), live("b", { id: 2 })]);
  if (!options.missingSettings) {
    client.setQueryData(["/api/user-settings"], { temperatureSourceDeviceId: options.pin });
  }
  if (options.settingsError) {
    client.getQueryCache().find({ queryKey: ["/api/user-settings"] })!.setState({
      status: "error", error: new Error("Cannot load source settings"),
    });
  }
  for (const board of boards) {
    for (const sensor of board.sensors) {
      client.setQueryData(
        ["/api/sensors/history", board.deviceId, sensor.sensorType, "24h"],
        options.rows ?? [row("a", 71), row("b", 83)],
      );
    }
  }
  try {
    return renderToStaticMarkup(createElement(QueryClientProvider, { client },
      createElement(History, options.manual ? { initialFollowDashboard: false } : {})));
  } finally {
    client.clear();
  }
}

test("History defaults to the pinned Dashboard board rather than the first History device", () => {
  const html = render({ pin: "b" });
  assert.match(html, /83.00/);
  assert.doesNotMatch(html, /71.00/);
  assert.match(html, /history-numeric-chart/);
  assert.match(html, /history-follow-status/);
});

test("History follows the exact Automatic Dashboard hardware and can reflect a changed pin", () => {
  const automatic = render({ pin: null });
  assert.match(automatic, /83.00/);
  assert.doesNotMatch(automatic, /71.00/);
  const changed = render({ pin: "a" });
  assert.match(changed, /71.00/);
  assert.doesNotMatch(changed, /83.00/);
});

test("following selects canonical Temperature, not the board's first pH or raw-temperature channel", () => {
  const board = historyBoard("b");
  board.sensors.unshift(
    { sensorType: "ph", label: "pH", unit: "pH", kind: "number", source: "sensor" },
    { sensorType: "temp_c", label: "Water temperature", unit: "°C", kind: "number", source: "sensor" },
  );
  const html = render({ pin: "b", boards: [historyBoard("a"), board] });
  assert.match(html, /Temperature history/);
  assert.match(html, /83.00/);
});

test("a pinned board can show its archive after its live temperature expires", () => {
  const html = render({
    pin: "b",
    latest: [live("a"), live("b", { recordedAt: new Date(now - 2 * 3600_000) })],
    boards: [historyBoard("a"), historyBoard("b", { lastReportedAt: new Date(now - 2 * 3600_000).toISOString() })],
  });
  assert.match(html, /83.00/);
  assert.match(html, /history-numeric-chart/);
});

test("a missing or 24-hour-inactive pin never silently shows another board", () => {
  for (const boards of [
    [historyBoard("a")],
    [historyBoard("a"), historyBoard("b", { lastReportedAt: new Date(now - 25 * 3600_000).toISOString() })],
  ]) {
    const html = render({ pin: "b", boards });
    assert.match(html, /history-source-unavailable/);
    assert.doesNotMatch(html, /history-numeric-chart/);
    assert.doesNotMatch(html, /71.00/);
    assert.match(html, /select-history-device/);
  }
});

test("a pinned board without canonical Temperature cannot fall back to an unrelated PCB channel", () => {
  const html = render({
    pin: "b",
    boards: [historyBoard("a"), historyBoard("b", {
      sensors: [{ sensorType: "die_c", label: "Die temperature", unit: "°C", kind: "number", source: "sensor" }],
    })],
  });
  assert.match(html, /history-source-unavailable/);
  assert.doesNotMatch(html, /history-numeric-chart/);
});

test("Automatic without an eligible live source does not substitute a 24-hour History board", () => {
  const html = render({
    pin: null,
    latest: [live("a", { recordedAt: new Date(now - 2 * 3600_000) }), live("b")],
    devices: [hardware("a"), hardware("b", { dashboardVisible: 0 })],
  });
  assert.match(html, /history-source-unavailable/);
  assert.doesNotMatch(html, /history-numeric-chart/);
});

test("loading or failed source settings cannot display an unrelated cached chart", () => {
  const loading = render({ pin: "b", missingSettings: true });
  assert.match(loading, /history-source-loading/);
  assert.doesNotMatch(loading, /history-numeric-chart/);
  const failed = render({ pin: "b", settingsError: true });
  assert.match(failed, /history-source-error/);
  assert.doesNotMatch(failed, /history-numeric-chart/);
});

test("manual browsing remains independent of the Dashboard pin and offers return to following", () => {
  const html = render({ pin: "b", manual: true });
  assert.match(html, /71.00/);
  assert.doesNotMatch(html, /83.00/);
  assert.match(html, /history-numeric-chart/);
  assert.match(html, /history-resume-following/);
});
