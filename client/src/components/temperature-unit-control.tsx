import React from "react";
import type { TemperatureDisplayUnit } from "@shared/temperature";

export function TemperatureUnitControl({
  unit, onChange, testId,
}: {
  unit: TemperatureDisplayUnit;
  onChange: (unit: TemperatureDisplayUnit) => void;
  testId: string;
}) {
  return (
    <div role="group" aria-label="Temperature display unit" className="inline-flex rounded-md border border-border p-0.5">
      {(["°C", "°F"] as const).map((option) => (
        <button
          key={option}
          type="button"
          data-testid={`button-${testId}-temperature-${option === "°C" ? "celsius" : "fahrenheit"}`}
          aria-pressed={unit === option}
          aria-label={`Display temperature in ${option === "°C" ? "Celsius" : "Fahrenheit"}`}
          onClick={() => onChange(option)}
          className={`rounded px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            unit === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
