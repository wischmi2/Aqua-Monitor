import { z } from "zod";

export const temperatureInputUnitSchema = z.enum(["unknown", "celsius", "fahrenheit"]);
export type TemperatureInputUnit = z.infer<typeof temperatureInputUnitSchema>;

export function normalizeTemperature(value: number, unit: string) {
  if (unit === "°C") return { value: value * 9 / 5 + 32, unit: "°F" };
  if (unit === "°F") return { value, unit };
  return { value, unit: "unknown" };
}

export function temperatureUnitLabel(unit: string) {
  return unit === "unknown" || !unit ? "Unit unknown" : unit;
}

// Explicit unit-bearing fields win over ambiguous aliases, including when nested.
// Device configuration applies only to generic fields, never to explicit units.
export function extractTemperature(
  payload: Record<string, any>,
  inputUnit: TemperatureInputUnit = "unknown",
): { value: number; unit: string } | undefined {
  const candidates = [payload, payload.data, payload.data?.value, payload.value, payload.data?.data];
  const groups = [
    { fields: ["temp_c", "tempC", "temp_celsius"], unit: "°C" },
    { fields: ["temp_f", "tempF", "temp_fahrenheit"], unit: "°F" },
    {
      fields: ["temp", "temperature", "Temperature", "TEMP"],
      unit: inputUnit === "celsius" ? "°C" : inputUnit === "fahrenheit" ? "°F" : "unknown",
    },
  ];
  for (const { fields, unit } of groups) {
    for (const field of fields) {
      for (const candidate of candidates) {
        const value = candidate?.[field];
        if (typeof value === "number" && Number.isFinite(value)) {
          return normalizeTemperature(value, unit);
        }
      }
    }
  }
}

export function canCheckTemperatureAlert(sensorType: string, unit: string) {
  return sensorType !== "temperature" || unit === "°F";
}
