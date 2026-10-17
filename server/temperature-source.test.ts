import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import type { Device, SensorReading, UserSettings } from "@shared/schema";
import { selectTemperatureReading, temperatureSourceError } from "@shared/temperature-source";
import { storage } from "./storage";
import { registerRoutes } from "./routes";

const now = Date.now();
const device = (overrides: Partial<Device> = {}): Device => ({
  id: 1, userId: "owner", tankId: null, name: "Temperature board",
  goliothDeviceId: "board-a", dashboardVisible: 1, deviceType: "sensor",
  temperatureInputUnit: "unknown", lastSeenAt: new Date(now), createdAt: new Date(now),
  ...overrides,
});
const reading = (overrides: Partial<SensorReading> = {}): SensorReading => ({
  id: 1, userId: "owner", deviceId: "board-a", sensorType: "temperature",
  value: 0, unit: "unknown", recordedAt: new Date(now - 10_000), ...overrides,
});

test("Automatic uses the newest temperature, while a pinned board keeps its own value and unit", () => {
  const own = reading();
  const other = reading({ id: 2, deviceId: "board-b", value: 78, unit: "°F", recordedAt: new Date(now) });
  assert.equal(selectTemperatureReading([own, other], null, now), other);
  assert.equal(selectTemperatureReading([own, other], "board-a", now), own);
  assert.equal(selectTemperatureReading([own, other], "board-a", now)?.value, 0);
  assert.equal(selectTemperatureReading([own, other], "board-a", now)?.unit, "unknown");
});

test("pinned hardware never silently falls back when stale, hidden, released, or missing", () => {
  const current = reading({ deviceId: "board-b" });
  const stale = reading({ recordedAt: new Date(now - 3600_000 - 1) });
  assert.equal(selectTemperatureReading([current, stale], "board-a", now), undefined);
  assert.equal(selectTemperatureReading([current], "board-a", now), undefined);
  assert.equal(selectTemperatureReading([reading({ sensorType: "ph" })], null, now), undefined);
  assert.equal(selectTemperatureReading([reading({ recordedAt: new Date(now + 3600_000) })], null, now), undefined);
});

test("source selection rejects foreign, hidden and non-reporting devices", () => {
  assert.equal(temperatureSourceError(null, "owner", [], [], now), null);
  assert.equal(temperatureSourceError("board-a", "owner", [device()], [reading()], now), null);
  for (const value of ["", 123, {}, []]) {
    assert.ok(temperatureSourceError(value, "owner", [device()], [reading()], now));
  }
  for (const overrides of [{ userId: "someone-else" }, { userId: null }, { dashboardVisible: 0 }]) {
    assert.ok(temperatureSourceError("board-a", "owner", [device(overrides)], [reading()], now));
  }
  assert.ok(temperatureSourceError("board-a", "owner", [device()],
    [reading({ recordedAt: new Date(now - 3600_000 - 1) })], now));
  assert.ok(temperatureSourceError("board-a", "owner", [device()],
    [reading({ userId: "someone-else" })], now));
});

test("temperature source preference persists per user, validates ownership and can reset without changing alert settings", async (t) => {
  let settings: UserSettings | undefined;
  let rows = [reading()];
  t.mock.method(storage, "getDevices", async () => [device()]);
  t.mock.method(storage, "getLatestSensorReadings", async () => rows);
  t.mock.method(storage, "getUserSettings", async () => settings);
  t.mock.method(storage, "createUserSettings", async (data: Partial<UserSettings>) => {
    settings = {
      id: 1, userId: "owner", phoneNumber: null, alertsEnabled: 1,
      alertCooldownMinutes: 30, temperatureSourceDeviceId: null, temperatureDisplayUnit: null,
      createdAt: new Date(), updatedAt: new Date(), ...data,
    };
    return settings;
  });
  t.mock.method(storage, "updateUserSettings", async (_userId: string, data: Partial<UserSettings>) => {
    const defined = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    settings = { ...settings!, ...defined };
    return settings;
  });
  const app = express();
  app.use(express.json());
  // Session fixture for this isolated test server only; app authentication remains intact.
  app.use((req: any, _res, next) => {
    req.isAuthenticated = () => req.headers["x-test-owner"] !== "anonymous";
    req.user = { claims: { sub: req.headers["x-test-owner"] ?? "owner" }, expires_at: Math.floor(Date.now() / 1000) + 600 };
    next();
  });
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/user-settings`;
  const patch = (body: object, owner = "owner") => fetch(url, {
    method: "PATCH", headers: { "content-type": "application/json", "x-test-owner": owner },
    body: JSON.stringify(body),
  });

  const first = await patch({ temperatureSourceDeviceId: "board-a" });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).temperatureSourceDeviceId, "board-a");
  const reloaded = await fetch(url);
  assert.equal((await reloaded.json()).temperatureSourceDeviceId, "board-a");
  assert.equal((await patch({ temperatureSourceDeviceId: "board-a" }, "someone-else")).status, 400);
  assert.equal((await patch({ temperatureSourceDeviceId: "board-a" }, "anonymous")).status, 401);
  assert.equal((await patch({ temperatureSourceDeviceId: 123 })).status, 400);
  assert.equal((await patch({ temperatureSourceDeviceId: "unowned-board" })).status, 400);
  assert.equal((await patch({ alertsEnabled: 0, alertCooldownMinutes: 45 })).status, 200);
  assert.equal(settings?.temperatureSourceDeviceId, "board-a");
  rows = [];
  const offline = await fetch(url);
  assert.equal((await offline.json()).temperatureSourceDeviceId, "board-a");
  assert.equal((await patch({ temperatureSourceDeviceId: "board-a" })).status, 400);
  const reset = await patch({ temperatureSourceDeviceId: null });
  assert.equal(reset.status, 200);
  const restored = await reset.json();
  assert.equal(restored.temperatureSourceDeviceId, null);
  assert.equal(restored.alertsEnabled, 0);
  assert.equal(restored.alertCooldownMinutes, 45);
});
