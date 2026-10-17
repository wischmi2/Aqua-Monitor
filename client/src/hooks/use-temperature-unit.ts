import { createContext, useContext, useSyncExternalStore } from "react";
import { isTemperatureDisplayUnit, type TemperatureDisplayUnit } from "@shared/temperature";

// Keep the existing History key so saved browser preferences continue to work.
export const TEMPERATURE_DISPLAY_STORAGE_KEY = "historyTemperatureDisplayUnit";
const listeners = new Set<() => void>();
const noSubscription = () => () => {};

export function readTemperatureDisplayPreference(): TemperatureDisplayUnit | null {
  try {
    const saved = typeof localStorage === "undefined"
      ? null : localStorage.getItem(TEMPERATURE_DISPLAY_STORAGE_KEY);
    return isTemperatureDisplayUnit(saved) ? saved : null;
  } catch {
    return null;
  }
}

let preference = readTemperatureDisplayPreference();

export function selectTemperatureUnit(unit: TemperatureDisplayUnit) {
  preference = unit;
  try {
    localStorage.setItem(TEMPERATURE_DISPLAY_STORAGE_KEY, unit);
  } catch {
    // The selection still applies to all mounted cards for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== TEMPERATURE_DISPLAY_STORAGE_KEY) return;
    preference = readTemperatureDisplayPreference();
    listeners.forEach((notify) => notify());
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTemperatureUnit() {
  const account = useContext(TemperaturePreferenceContext);
  const selected = useSyncExternalStore(account ? noSubscription : subscribe, () => preference, readTemperatureDisplayPreference);
  return account ?? {
    unit: selected ?? "°F", setUnit: selectTemperatureUnit,
    disabled: false, status: null, retry: undefined,
  };
}

export interface TemperaturePreference {
  unit: TemperatureDisplayUnit;
  setUnit: (unit: TemperatureDisplayUnit) => void;
  disabled: boolean;
  status: string | null;
  retry?: () => void;
}

export const TemperaturePreferenceContext = createContext<TemperaturePreference | null>(null);
