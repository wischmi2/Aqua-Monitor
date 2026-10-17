import React, { useRef, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserSettings } from "@shared/schema";
import { isTemperatureDisplayUnit, type TemperatureDisplayUnit } from "@shared/temperature";
import { apiRequest } from "@/lib/queryClient";
import { readTemperatureDisplayPreference, TemperaturePreferenceContext } from "@/hooks/use-temperature-unit";

// Mounted once per authenticated account so every temperature view shares the
// same in-flight save, errors, and authoritative account preference.
export function TemperaturePreferenceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const client = useQueryClient();
  const key = ["/api/user-settings", userId];
  const legacy = useRef(readTemperatureDisplayPreference());
  const settings = useQuery<UserSettings>({
    queryKey: key,
    queryFn: async () => (await apiRequest("GET", "/api/user-settings")).json(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const saving = useRef(false);
  const save = useMutation({
    mutationFn: async (unit: TemperatureDisplayUnit): Promise<UserSettings> =>
      (await apiRequest("PATCH", "/api/user-settings", { temperatureDisplayUnit: unit })).json(),
    onSuccess: (updated) => {
      // Updating only after success leaves a failed selection easy to retry and
      // never marks a browser-only choice as saved to the account.
      client.setQueryData(key, updated);
      void client.invalidateQueries({ queryKey: ["/api/user-settings"], exact: true });
    },
    onSettled: () => { saving.current = false; },
  });
  const savedUnit = settings.data?.temperatureDisplayUnit;
  const unit = save.isPending ? save.variables
    : isTemperatureDisplayUnit(savedUnit) ? savedUnit
    : settings.data ? legacy.current ?? "°F" : "°F";
  const loadFailed = settings.isError && !settings.data;
  const disabled = settings.isPending || loadFailed || save.isPending;
  const setUnit = (next: TemperatureDisplayUnit) => {
    if (disabled || saving.current || !isTemperatureDisplayUnit(next)) return;
    saving.current = true;
    save.mutate(next);
  };
  const status = settings.isPending ? "Loading saved temperature unit…"
    : loadFailed ? "Could not load your temperature preference."
    : save.isPending ? "Saving temperature preference…"
    : save.isError ? "Could not save your temperature preference. Your previous unit has been restored."
    : null;

  return (
    <TemperaturePreferenceContext.Provider value={{
      unit, setUnit, disabled, status,
      retry: loadFailed ? () => { void settings.refetch(); }
        : save.isError ? () => setUnit(save.variables) : undefined,
    }}>
      {children}
    </TemperaturePreferenceContext.Provider>
  );
}
