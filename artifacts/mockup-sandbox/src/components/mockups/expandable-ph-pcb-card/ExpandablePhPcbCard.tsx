import { useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Gauge,
  Radio,
  Thermometer,
  X,
  Zap,
} from "lucide-react";

import "./_group.css";

type Metric = {
  label: string;
  value: string;
  unit?: string;
  tone?: "default" | "warning" | "success";
};

const phMetrics: Metric[] = [
  { label: "pH level", value: "3.963", unit: "pH", tone: "warning" },
  { label: "Calibration", value: "7", unit: "point" },
  { label: "Sensor signal", value: "155.93", unit: "mV" },
  { label: "Water temperature", value: "25.1", unit: "°C" },
];

const batteryMetrics: Metric[] = [
  { label: "Charge state", value: "Charging", tone: "success" },
  { label: "Charge status", value: "9", unit: "code" },
  { label: "Battery voltage", value: "3.657", unit: "V", tone: "success" },
  { label: "Current draw", value: "152.5", unit: "mA" },
  { label: "Die temperature", value: "42.8", unit: "°C" },
  { label: "Error code", value: "0", unit: "none", tone: "success" },
];

function MetricRow({ metric }: { metric: Metric }) {
  const valueColor =
    metric.tone === "warning"
      ? "text-red-600"
      : metric.tone === "success"
        ? "text-emerald-600"
        : "text-foreground";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{metric.label}</span>
      <span className={`text-right font-mono text-xs font-medium ${valueColor}`}>
        {metric.value}
        {metric.unit && (
          <span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">
            {metric.unit}
          </span>
        )}
      </span>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  metrics,
  children,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  metrics: Metric[];
  children?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-background/65 p-3.5">
      <div className="mb-2.5 flex items-start gap-2.5">
        <div className="rounded-md bg-muted p-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div>{metrics.map((metric) => <MetricRow key={metric.label} metric={metric} />)}</div>
      {children}
    </section>
  );
}

function StatusBadge({ expanded }: { expanded: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-medium capitalize text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
      Critical
      {expanded ? "" : " · tap to inspect"}
    </span>
  );
}

export function ExpandablePhPcbCard() {
  const [expanded, setExpanded] = useState(() =>
    new URLSearchParams(window.location.search).get("state") === "expanded",
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5 sm:p-8">
      <div className="w-full max-w-[600px]">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Sensor PCB
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              One card for readings and board health
            </p>
          </div>
          <span className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground">
            LightDB
          </span>
        </div>

        <div
          className={[
            "overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm transition-shadow",
            expanded ? "shadow-md" : "hover:shadow-md",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls="ph-pcb-details"
            className="group w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative rounded-md bg-muted p-2">
                    <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <div
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-red-500"
                      aria-label="Status: critical"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium">pH PCB</span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                      ph_nrf54lm20a
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge expanded={expanded} />
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground" aria-hidden="true" />
                  )}
                </div>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-3xl font-medium tracking-tight text-red-600" data-testid="ph-card-value">
                    3.963
                  </span>
                  <span className="text-sm text-muted-foreground">pH</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-red-600">Below target range</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Updated just now</p>
                </div>
              </div>

              {!expanded && (
                <div className="flex items-center justify-between border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <BatteryCharging className="h-3.5 w-3.5" aria-hidden="true" />
                    Charging · 3.657 V
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    View all PCB data
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
              )}
            </div>
          </button>

          {expanded && (
            <div id="ph-pcb-details" className="border-t border-border/70 px-4 pb-4 pt-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Radio className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  Latest LightDB stream payload
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Collapse pH PCB details"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Close
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SectionCard
                  icon={Gauge}
                  title="pH readings"
                  description="Water quality measurements"
                  metrics={phMetrics}
                >
                  <div className="mt-2 rounded-md bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-800">
                    <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" />
                    pH is outside the configured 8.0–8.4 normal range.
                  </div>
                </SectionCard>

                <SectionCard
                  icon={BatteryCharging}
                  title="Battery & health"
                  description="Power and board telemetry"
                  metrics={batteryMetrics}
                >
                  <div className="mt-2 flex items-center justify-between rounded-md bg-emerald-50 px-2.5 py-2 text-[10px] text-emerald-800">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      VBUS connected
                    </span>
                    <Zap className="h-3 w-3" aria-hidden="true" />
                  </div>
                </SectionCard>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground sm:grid-cols-4">
                <span className="inline-flex items-center gap-1.5">
                  <Cpu className="h-3 w-3" aria-hidden="true" />
                  Board online
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Thermometer className="h-3 w-3" aria-hidden="true" />
                  Temp in °C
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BatteryCharging className="h-3 w-3" aria-hidden="true" />
                  Battery active
                </span>
                <span className="text-right font-mono">err: 0</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}