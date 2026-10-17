import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LineChart, Line, XAxis, YAxis } from "recharts";
import { buildHistoryAxis, formatHistoryAxisTick } from "../lib/history-axis";

const start = Date.parse("2026-10-17T15:55:00Z");
const minute = 60_000;

test("dense History readings get a bounded number of regularly spaced desktop ticks", () => {
  const timestamps = Array.from({ length: 1200 }, (_, i) => start + i * 2900);
  const axis = buildHistoryAxis(timestamps, 1000);
  assert.ok(axis.ticks.length >= 3 && axis.ticks.length <= 7);
  assert.deepEqual(axis.domain, [timestamps[0], timestamps[timestamps.length - 1]]);
  const step = axis.ticks[1] - axis.ticks[0];
  axis.ticks.slice(1).forEach((tick, i) => assert.equal(tick - axis.ticks[i], step));
  assert.equal(timestamps.length, 1200);
});

test("phone charts show fewer time labels without dropping or changing readings", () => {
  const timestamps = [start, start + 58 * minute];
  const desktop = buildHistoryAxis(timestamps, 1000);
  const mobile = buildHistoryAxis(timestamps, 375);
  assert.ok(mobile.ticks.length > 0 && mobile.ticks.length <= 2);
  assert.ok(mobile.ticks.length < desktop.ticks.length);
  assert.deepEqual(mobile.domain, desktop.domain);
});

test("single-time, duplicate-time and empty History charts have valid axis domains", () => {
  assert.deepEqual(buildHistoryAxis([], 375).ticks, []);
  assert.deepEqual(buildHistoryAxis([NaN, Infinity], 375).ticks, []);
  const axis = buildHistoryAxis([start, start], 375);
  assert.ok(axis.domain[0] < start && axis.domain[1] > start);
  assert.deepEqual(axis.ticks, [start]);
});

test("axis labels use actual elapsed time and distinguish sub-minute measurements", () => {
  const first = formatHistoryAxisTick(start, 30_000, "en-US");
  const second = formatHistoryAxisTick(start + 10_000, 30_000, "en-US");
  assert.notEqual(first, second);
  assert.match(first, /:00/);
  assert.match(formatHistoryAxisTick(start, 58 * minute, "en-US"), /\d:\d{2}/);
  assert.match(formatHistoryAxisTick(start, 7 * 24 * 60 * minute, "en-US"), /Oct/);
});

test("all ticks remain inside the measured range across short and long windows", () => {
  for (const span of [10, 30_000, 3 * minute, 60 * minute, 24 * 60 * minute, 30 * 24 * 60 * minute]) {
    for (const width of [320, 768, 1440]) {
      const axis = buildHistoryAxis([start, start + span], width);
      assert.ok(axis.ticks.length >= 1 && axis.ticks.length <= 7);
      assert.ok(axis.ticks.every((tick) => tick >= start && tick <= start + span));
    }
  }
});

test("desktop and phone SVG charts render only the budgeted timestamp labels", () => {
  const data = Array.from({ length: 60 }, (_, i) => ({ timestamp: start + i * minute, value: 75 }));
  for (const width of [375, 1000]) {
    const axis = buildHistoryAxis(data.map((row) => row.timestamp), width);
    const html = renderToStaticMarkup(createElement(LineChart, { width, height: 300, data },
      createElement(XAxis, {
        dataKey: "timestamp", type: "number", scale: "time",
        domain: axis.domain, ticks: axis.ticks,
        tickFormatter: (value: number) => formatHistoryAxisTick(value, axis.span, "en-US"),
        interval: "preserveStartEnd", minTickGap: 28,
      }),
      createElement(YAxis, { hide: true }),
      createElement(Line, { dataKey: "value", isAnimationActive: false }),
    ));
    const timeLabels = Array.from(html.matchAll(/<tspan[^>]*>([^<]*(?:AM|PM))<\/tspan>/g));
    assert.ok(timeLabels.length > 0);
    assert.ok(timeLabels.length <= axis.ticks.length);
    assert.ok(timeLabels.length <= (width < 500 ? 2 : 7));
  }
});
