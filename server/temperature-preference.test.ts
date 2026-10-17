import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express from "express";
import { inArray } from "drizzle-orm";
import { db } from "./db";
import { userSettings } from "@shared/schema";
import { DatabaseStorage, storage } from "./storage";
import { registerRoutes } from "./routes";

test("authenticated display preferences persist in PostgreSQL and remain owned by the signed-in user", async (t) => {
  const owner = `preference-test-${randomUUID()}`;
  const other = `preference-test-${randomUUID()}`;
  t.after(async () => {
    await db.delete(userSettings).where(inArray(userSettings.userId, [owner, other]));
  });
  const app = express();
  app.use(express.json());
  // Isolated test sessions only. Real application authentication is unchanged.
  app.use((req: any, _res, next) => {
    req.isAuthenticated = () => req.headers["x-test-user"] !== "anonymous";
    req.user = {
      claims: { sub: req.headers["x-test-user"] ?? owner },
      expires_at: Math.floor(Date.now() / 1000) + 600,
    };
    next();
  });
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/user-settings`;
  const get = (user = owner) => fetch(url, { headers: { "x-test-user": user } });
  const patch = (body: object, user = owner) => fetch(url, {
    method: "PATCH", headers: { "content-type": "application/json", "x-test-user": user },
    body: JSON.stringify(body),
  });

  assert.equal((await get("anonymous")).status, 401);
  assert.equal((await patch({ temperatureDisplayUnit: "°C" }, "anonymous")).status, 401);
  // First save creates settings, including the same SMS defaults as before.
  const first = await patch({ temperatureDisplayUnit: "°C", userId: other });
  assert.equal(first.status, 200);
  const initial = await first.json();
  assert.equal(initial.userId, owner);
  assert.equal(initial.temperatureDisplayUnit, "°C");
  assert.equal(initial.alertsEnabled, 1);
  assert.equal(initial.alertCooldownMinutes, 30);
  // A fresh storage instance and a fresh HTTP request have no browser state.
  assert.equal((await new DatabaseStorage().getUserSettings(owner))?.temperatureDisplayUnit, "°C");
  assert.equal((await (await get()).json()).temperatureDisplayUnit, "°C");
  const otherDefaults = await (await get(other)).json();
  assert.equal(otherDefaults.temperatureDisplayUnit, null);
  assert.equal((await patch({ temperatureDisplayUnit: "°F", userId: owner }, other)).status, 200);
  assert.equal((await (await get()).json()).temperatureDisplayUnit, "°C");
  assert.equal((await (await get(other)).json()).temperatureDisplayUnit, "°F");

  for (const invalid of [null, "", "celsius", "fahrenheit", "unknown", 22, {}, []]) {
    assert.equal((await patch({ temperatureDisplayUnit: invalid })).status, 400);
  }
  assert.equal((await (await get()).json()).temperatureDisplayUnit, "°C");
  await patch({ alertsEnabled: 0, alertCooldownMinutes: 45, phoneNumber: "+12025550123" });
  assert.equal((await (await get()).json()).temperatureDisplayUnit, "°C");
  const updated = await (await patch({ temperatureDisplayUnit: "°F", temperatureInputUnit: "celsius" })).json();
  assert.equal(updated.temperatureDisplayUnit, "°F");
  assert.equal(updated.alertsEnabled, 0);
  assert.equal(updated.alertCooldownMinutes, 45);
  assert.equal(updated.phoneNumber, "+12025550123");
  assert.equal(updated.temperatureSourceDeviceId, null);
  assert.equal("temperatureInputUnit" in updated, false);
  // A concurrent default GET must not reset an explicit preference.
  await Promise.all([
    storage.createUserSettings({ userId: owner }),
    storage.updateUserSettings(owner, { temperatureDisplayUnit: "°C" }),
  ]);
  assert.equal((await storage.getUserSettings(owner))?.temperatureDisplayUnit, "°C");

  // Database failures are visible API errors, not successful local-only saves.
  t.mock.method(storage, "updateUserSettings", async () => { throw new Error("test save failure"); });
  t.mock.method(console, "error", () => {});
  assert.equal((await patch({ temperatureDisplayUnit: "°F" })).status, 500);
  assert.equal((await (await get()).json()).temperatureDisplayUnit, "°C");
});
