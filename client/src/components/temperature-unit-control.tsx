import React from "react";
import type { TemperatureDisplayUnit } from "@shared/temperature";
import { useTemperatureUnit } from "@/hooks/use-temperature-unit";

export function TemperatureUnitControl({
  unit, onChange, testId,
}: {
  unit: TemperatureDisplayUnit;
  onChange: (unit: TemperatureDisplayUnit) => void;
  testId: string;
}) {
  const { disabled } = useTemperatureUnit();
  return (
    <div>
    <div role="group" aria-label="Temperature display unit" className="inline-flex rounded-md border border-border p-0.5">
      {(["°C", "°F"] as const).map((option) => (
        <button
          key={option}
          type="button"
          data-testid={`button-${testId}-temperature-${option === "°C" ? "celsius" : "fahrenheit"}`}
          aria-pressed={unit === option}
          aria-label={`Display temperature in ${option === "°C" ? "Celsius" : "Fahrenheit"}`}
          disabled={disabled}
          onClick={() => onChange(option)}
          className={`rounded px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            unit === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
    <TemperaturePreferenceStatus />
    </div>
  );
}

export function TemperaturePreferenceStatus() {
  const { status, retry } = useTemperatureUnit();
  return status ? (
      <p role="status" className="text-xs text-muted-foreground mt-1">
        {status} {retry && <button type="button" onClick={retry} className="underline">Retry</button>}
      </p>
  ) : null;
}
