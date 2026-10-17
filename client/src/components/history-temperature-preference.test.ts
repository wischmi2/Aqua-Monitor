import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TemperaturePreferenceProvider } from "./temperature-preference-provider";
import History from "../pages/history";
import type { UserSettings } from "@shared/schema";
import type { HistoryDevice, HistoryReading } from "@shared/history";

test("History renders the account unit, keeps legacy fallback, and never relabels unknown readings", () => {
  const now = new Date().toISOString();
  const device: HistoryDevice = {
    deviceId: "board", name: "Water board", deviceType: "sensor", lastReportedAt: now,
    sensors: [{ sensorType: "temperature", label: "Temperature", unit: "°F", kind: "numeric", source: "sensor" }],
  };
  const reading: HistoryReading = {
    id: "sensor:1", deviceId: "board", sensorType: "temperature",
    value: 77, unit: "°F", recordedAt: now, source: "sensor",
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "°F" } });
  try {
    for (const [unit, sourceUnit, expected] of [
      ["°C", "°F", "25.00"], ["°F", "°F", "77.00"], [null, "°F", "77.00"],
      ["°C", "unknown", "77.00"],
    ] as const) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
      const settings: UserSettings = {
        id: 1, userId: "owner", temperatureDisplayUnit: unit, temperatureSourceDeviceId: null,
        phoneNumber: null, alertsEnabled: 1, alertCooldownMinutes: 30,
        createdAt: new Date(), updatedAt: new Date(),
      };
      client.setQueryData(["/api/user-settings", "owner"], settings);
      client.setQueryData(["/api/sensors/history/devices"], [device]);
      client.setQueryData(["/api/sensors/history", "board", "temperature", "24h"], [{ ...reading, unit: sourceUnit }]);
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(TemperaturePreferenceProvider, { userId: "owner", children: createElement(History) })));
      assert.match(html, new RegExp(expected));
      if (sourceUnit === "unknown") {
        assert.match(html, /Unit unknown/);
        assert.doesNotMatch(html, /button-history-temperature-celsius/);
      } else {
        const selected = unit === "°C" ? "celsius" : "fahrenheit";
        assert.match(html, new RegExp(`button-history-temperature-${selected}" aria-pressed="true"`));
      }
      assert.equal(reading.value, 77);
      assert.equal(reading.unit, "°F");
      client.clear();
    }
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
