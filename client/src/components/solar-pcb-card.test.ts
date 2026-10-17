import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SolarPcbCard } from "./solar-pcb-card";
import type { SolarPcbDeviceData } from "@shared/schema";

const base: SolarPcbDeviceData = {
  deviceId: "solar-test", deviceName: "Solar power board",
  lastUpdated: null, readings: {},
};

test("solar card missing data is explicit and does not display a fabricated percentage", () => {
  const html = renderToStaticMarkup(createElement(SolarPcbCard, { data: base }));
  assert.match(html, /Not reported/);
  assert.match(html, /No data/);
  assert.doesNotMatch(html, />0</);
  assert.match(html, /aria-expanded="false"/);
});

test("solar card keeps zero percent, raw charge state, power source, and stale indication", () => {
  const recordedAt = new Date("2020-01-01T00:00:00Z");
  const html = renderToStaticMarkup(createElement(SolarPcbCard, { data: {
    ...base, lastUpdated: recordedAt, readings: {
      soc_pct: { value: 0, recordedAt },
      charge: { value: "IDLE", recordedAt },
      source: { value: "BATTERY", recordedAt },
    },
  } }));
  assert.match(html, /solar-pcb-card-value">0</);
  assert.match(html, /Source: BATTERY/);
  assert.match(html, /Charge: IDLE/);
  assert.match(html, /Telemetry delayed/);
});
