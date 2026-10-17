import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Settings from "../pages/settings";

test("Settings exposes a saved per-device temperature unit with future-only guidance", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["/api/auth/user"], { id: "owner" });
  client.setQueryData(["/api/devices"], [{
    id: 7, name: "Temperature board", goliothDeviceId: "board", deviceType: "auto",
    temperatureInputUnit: "celsius", dashboardVisible: 1, lastSeenAt: null,
  }]);
  client.setQueryData(["/api/devices/unclaimed"], []);
  client.setQueryData(["/api/alerts"], []);
  client.setQueryData(["/api/user-settings"], {});
  try {
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Settings)));
    assert.match(html, /select-temperature-unit-7/);
    assert.match(html, /Temperature input unit for Temperature board/);
    assert.match(html, /Changes apply to future readings only/);
    assert.match(html, /Explicit °C \/ °F fields override this setting/);
    assert.match(html, /Older generic readings labeled °F may need a separate, verified correction/);
  } finally {
    client.clear();
  }
});
