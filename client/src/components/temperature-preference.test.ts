import assert from "node:assert/strict";
import test from "node:test";
import React, { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UserSettings } from "@shared/schema";
import { TemperaturePreferenceProvider } from "./temperature-preference-provider";
import { TemperatureUnitControl } from "./temperature-unit-control";
import { useTemperatureUnit } from "../hooks/use-temperature-unit";

const settings = (unit: "°C" | "°F" | null, userId = "owner"): UserSettings => ({
  id: 1, userId, temperatureDisplayUnit: unit, temperatureSourceDeviceId: null,
  phoneNumber: null, alertsEnabled: 1, alertCooldownMinutes: 30,
  createdAt: new Date(), updatedAt: new Date(),
});
const makeClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: 0 }, mutations: { retry: false } },
});
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
// Response.json() and React Query's scheduled notification take separate turns.
// Two turns avoid a timer expiring before the notification has been scheduled.
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function Control() {
  const preference = useTemperatureUnit();
  return createElement(TemperatureUnitControl, {
    unit: preference.unit, onChange: preference.setUnit, testId: "history",
  });
}
function tree(client: QueryClient, userId = "owner") {
  return createElement(QueryClientProvider, { client },
    createElement(TemperaturePreferenceProvider, { userId, key: userId, children: createElement(Control) }));
}
const choice = (view: ReactTestRenderer, unit: "celsius" | "fahrenheit") =>
  view.root.findByProps({ "data-testid": `button-history-temperature-${unit}` });
const text = (view: ReactTestRenderer) => JSON.stringify(view.toJSON());

test("account selection loads, saves, rolls back errors, retries, and works in a fresh browser", async (t) => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true, value: { getItem: () => "°F", setItem: () => { throw new Error("blocked"); } },
  });
  t.after(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });
  let saved = settings("°C");
  let failLoad = false;
  let failSave = false;
  let releaseLoad!: () => void;
  let releaseSave!: () => void;
  let loadGate: Promise<void> | undefined = new Promise((resolve) => { releaseLoad = resolve; });
  let saveGate: Promise<void> | undefined;
  const writes: object[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    assert.equal(url, "/api/user-settings");
    assert.equal(init?.credentials, "include");
    if (init?.method === "PATCH") {
      const body = JSON.parse(init.body as string);
      writes.push(body);
      await saveGate;
      if (failSave) return response({ message: "Save failed" }, 500);
      saved = { ...saved, ...body };
      return response(saved);
    }
    await loadGate;
    return failLoad ? response({ message: "Load failed" }, 500) : response(saved);
  });
  let view!: ReactTestRenderer;
  let client = makeClient();
  await act(async () => { view = create(tree(client)); });
  t.after(async () => { await act(async () => view.unmount()); client.clear(); });
  assert.equal(choice(view, "celsius").props.disabled, true);
  assert.match(text(view), /Loading saved temperature unit/);
  assert.equal(writes.length, 0);
  await act(async () => { releaseLoad(); loadGate = undefined; await flush(); });
  assert.equal(choice(view, "celsius").props["aria-pressed"], true, text(view));
  assert.equal(choice(view, "celsius").props.disabled, false);
  assert.equal(writes.length, 0, "loading an account preference must not write the browser fallback");

  saveGate = new Promise((resolve) => { releaseSave = resolve; });
  await act(async () => { choice(view, "fahrenheit").props.onClick(); await flush(); });
  assert.match(text(view), /Saving temperature preference/);
  assert.equal(choice(view, "fahrenheit").props["aria-pressed"], true);
  assert.equal(choice(view, "celsius").props.disabled, true);
  await act(async () => { releaseSave(); saveGate = undefined; await flush(); });
  assert.deepEqual(writes, [{ temperatureDisplayUnit: "°F" }]);
  assert.equal(saved.temperatureDisplayUnit, "°F");

  failSave = true;
  await act(async () => { choice(view, "celsius").props.onClick(); await flush(); });
  assert.match(text(view), /Could not save.*previous unit has been restored/);
  assert.equal(choice(view, "fahrenheit").props["aria-pressed"], true);
  failSave = false;
  await act(async () => {
    view.root.findAllByType("button").find((button) => button.children.includes("Retry"))!.props.onClick();
    await flush();
  });
  assert.equal(saved.temperatureDisplayUnit, "°C");
  assert.equal(choice(view, "celsius").props["aria-pressed"], true);

  // Simulate a second browser: no local storage, query cache, or component state.
  await act(async () => { view.unmount(); });
  client.clear();
  delete (globalThis as { localStorage?: unknown }).localStorage;
  client = makeClient();
  await act(async () => { view = create(tree(client)); await flush(); });
  assert.equal(choice(view, "celsius").props["aria-pressed"], true);
  // A different signed-in account must not receive the previous account's cache.
  saved = settings("°F", "other");
  await act(async () => { view.update(tree(client, "other")); await flush(); });
  assert.equal(choice(view, "fahrenheit").props["aria-pressed"], true);

  await act(async () => { view.unmount(); });
  client.clear();
  client = makeClient();
  failLoad = true;
  await act(async () => { view = create(tree(client)); await flush(); });
  assert.match(text(view), /Could not load your temperature preference/);
  assert.equal(choice(view, "celsius").props.disabled, true);
  failLoad = false;
  await act(async () => {
    view.root.findAllByType("button").find((button) => button.children.includes("Retry"))!.props.onClick();
    await flush();
  });
  assert.equal(choice(view, "fahrenheit").props.disabled, false);
});

