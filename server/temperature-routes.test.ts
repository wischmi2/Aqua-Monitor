import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createServer } from "node:http";
import { storage } from "./storage";
import { registerRoutes } from "./routes";
import type { Device, SensorReading } from "@shared/schema";

test("device settings govern subsequent webhook ingestion, enforce ownership, and preserve temperature history", async (t) => {
  let device: Device = {
    id: 7, userId: "owner", tankId: null, goliothDeviceId: "test-temperature-board",
    name: "Temperature board", deviceType: "auto", dashboardVisible: 1,
    temperatureInputUnit: "unknown", createdAt: new Date(), lastSeenAt: null,
  };
  const now = new Date();
  const readings: SensorReading[] = [{
    id: 1, userId: "owner", deviceId: device.goliothDeviceId, sensorType: "temperature",
    value: 22, unit: "°F", recordedAt: now,
  }];
  t.mock.method(storage, "getDeviceById", async (id: number) => id === device.id ? device : undefined);
  t.mock.method(storage, "getDeviceByGoliothId", async () => device);
  t.mock.method(storage, "getDevices", async () => [device]);
  t.mock.method(storage, "updateDeviceLastSeen", async () => device);
  t.mock.method(storage, "updateDevice", async (_id: number, data: Partial<Device>) => (device = { ...device, ...data }));
  t.mock.method(storage, "createSensorReading", async (row: SensorReading) => {
    const stored = { ...row, id: readings.length + 1 };
    readings.push(stored);
    return stored;
  });
  const alertLookup = t.mock.method(storage, "getUserSettings", async () => undefined);
  t.mock.method(storage, "getSolarPcbReadings", async () => []);
  t.mock.method(storage, "getLatestSensorReadings", async () => [readings.at(-1)!]);
  t.mock.method(storage, "getSensorHistory", async (_owner: string, sensor: string, _since: Date, id: string) =>
    readings.filter((row) => row.sensorType === sensor && row.deviceId === id));
  const app = express();
  app.use(express.json());
  // Test-only session fixture; production authentication is unchanged.
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
  const base = `http://127.0.0.1:${address.port}`;
  const request = (path: string, body?: object, owner = "owner", method = "PATCH") =>
    fetch(`${base}${path}`, {
      method, headers: { "content-type": "application/json", "x-test-owner": owner },
      body: body ? JSON.stringify(body) : undefined,
    });
  const patch = (unit: unknown, owner = "owner") =>
    request("/api/devices/7", { temperatureInputUnit: unit }, owner);
  const webhook = (payload: object) => fetch(`${base}/webhooks/golioth`, {
    method: "POST", headers: { "content-type": "application/json", "ce-time": now.toISOString() },
    body: JSON.stringify({ deviceId: device.goliothDeviceId, ...payload }),
  });

  assert.equal((await patch("celsius", "anonymous")).status, 401);
  assert.equal((await patch("celsius", "other-owner")).status, 403);
  for (const invalid of ["kelvin", "C", null, 0, {}]) {
    assert.equal((await patch(invalid)).status, 400);
  }
  assert.equal(device.temperatureInputUnit, "unknown");
  assert.equal((await webhook({ temp: 22 })).status, 200);
  assert.equal(readings.at(-1)?.unit, "unknown");
  assert.equal(readings.at(-1)?.value, 22);
  assert.equal(alertLookup.mock.callCount(), 0, "unknown temperatures skip threshold lookups");

  const saved = await patch("celsius");
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).temperatureInputUnit, "celsius");
  assert.equal((await webhook({ data: { value: { TEMP: 22 } } })).status, 200);
  assert.equal(readings.at(-1)?.value, 71.6);
  assert.equal(readings.at(-1)?.unit, "°F");
  assert.equal((await webhook({ temp_f: 75 })).status, 200);
  assert.equal(readings.at(-1)?.value, 75);
  assert.equal((await patch("fahrenheit")).status, 200);
  assert.equal((await webhook({ temperature: 78 })).status, 200);
  assert.equal(readings.at(-1)?.value, 78);
  assert.equal((await webhook({ temp: 99, temp_c: 22 })).status, 200);
  const shared = readings.filter((row) => row.sensorType === "temperature").at(-1)!;
  assert.equal(shared.value, 71.6);
  assert.equal(shared.unit, "°F");
  const pcb = readings.find((row) => row.sensorType === "temp_c")!;
  assert.equal(pcb.value, 22);
  assert.equal(pcb.unit, "°C");
  assert.equal((await patch("unknown")).status, 200);
  assert.equal((await webhook({ temp: 23 })).status, 200);
  assert.equal(readings.at(-1)?.unit, "unknown");

  const history = await request(`/api/sensors/history?deviceId=${device.goliothDeviceId}&sensorType=temperature&timeRange=24h`, undefined, "owner", "GET");
  assert.equal(history.status, 200);
  const rows = await history.json();
  assert.ok(rows.some((row: SensorReading) => row.value === 71.6 && row.unit === "°F"));
  assert.ok(rows.some((row: SensorReading) => row.value === 22 && row.unit === "unknown"));
  assert.equal(rows[0].value, 22, "original history value is not rewritten by setting changes");
  assert.equal(rows[0].unit, "°F", "original history label is not rewritten by setting changes");
});
