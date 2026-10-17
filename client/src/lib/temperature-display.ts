import { convertTemperatureForDisplay, temperatureUnitLabel, type TemperatureDisplayUnit } from "@shared/temperature";

export function displayTemperature(value: number, sourceUnit: string, targetUnit: TemperatureDisplayUnit) {
  const converted = convertTemperatureForDisplay(value, sourceUnit, targetUnit);
  return converted === null
    ? { value, unit: temperatureUnitLabel(sourceUnit) }
    : { value: converted, unit: targetUnit };
}

// Dashboard temperature ranges are defined in Fahrenheit, never in display units.
export function temperatureStatus(value: number, sourceUnit: string): "normal" | "warning" | "critical" | "unknown" {
  const fahrenheit = convertTemperatureForDisplay(value, sourceUnit, "°F");
  if (fahrenheit === null) return "unknown";
  if (fahrenheit >= 76 && fahrenheit <= 82) return "normal";
  if (fahrenheit >= 74 && fahrenheit <= 84) return "warning";
  return "critical";
}
