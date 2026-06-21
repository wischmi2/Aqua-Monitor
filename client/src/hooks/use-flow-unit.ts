import { useState, useEffect } from "react";

export type FlowUnit = "gallons" | "liters";

const L_TO_GAL = 0.264172;

export function useFlowUnit() {
  const [unit, setUnit] = useState<FlowUnit>(() => {
    return (localStorage.getItem("flowUnit") as FlowUnit) ?? "gallons";
  });

  useEffect(() => {
    localStorage.setItem("flowUnit", unit);
  }, [unit]);

  function convertRate(lpm: number) {
    return unit === "gallons" ? lpm * L_TO_GAL : lpm;
  }

  function convertVolume(liters: number) {
    return unit === "gallons" ? liters * L_TO_GAL : liters;
  }

  const rateUnit = unit === "gallons" ? "GPM" : "L/min";
  const volumeUnit = unit === "gallons" ? "gal" : "L";

  return { unit, setUnit, convertRate, convertVolume, rateUnit, volumeUnit };
}
