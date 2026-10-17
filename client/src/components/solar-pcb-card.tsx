import React, { useState } from "react";
import { AlertTriangle, BatteryCharging, ChevronDown, ChevronUp, Radio, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SolarPcbDeviceData, SolarPcbMetric } from "@shared/schema";

const STALE_AFTER_MS = 5 * 60 * 1000;

type MetricDefinition = {
  key: SolarPcbMetric;
  label: string;
  unit?: string;
};

const powerMetrics: MetricDefinition[] = [
  { key: "aem", label: "AEM" },
  { key: "aem_window", label: "AEM window" },
  { key: "charge", label: "Charge state" },
  { key: "source", label: "Power source" },
];

const electricalMetrics: MetricDefinition[] = [
  { key: "soc_pct", label: "State of charge", unit: "%" },
  { key: "ibat_ma", label: "Battery current", unit: "mA" },
  { key: "usb_cc", label: "USB-C CC" },
  { key: "vbat_mv", label: "Battery voltage", unit: "mV" },
  { key: "vbat_rise_mv", label: "Battery voltage rise", unit: "mV" },
  { key: "vbus", label: "VBUS" },
];

function formatValue(value: number | string | boolean): string {
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

function isStale(recordedAt: Date | string, now = Date.now()): boolean {
  const timestamp = new Date(recordedAt).getTime();
  return Number.isFinite(timestamp) && now - timestamp > STALE_AFTER_MS;
}

function formatAge(date?: Date | string | null): string {
  if (!date) return "No data";
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return "No data";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function MetricRow({
  definition,
  reading,
}: {
  definition: MetricDefinition;
  reading?: SolarPcbDeviceData["readings"][SolarPcbMetric];
}) {
  const stale = reading ? isStale(reading.recordedAt) : false;

  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-b-0"
      data-testid={`solar-pcb-metric-${definition.key}`}
    >
      <span className="text-xs text-muted-foreground">{definition.label}</span>
      <span className={cn(
        "text-right font-mono text-xs font-medium",
        !reading && "font-sans text-muted-foreground",
        stale && "text-amber-700 dark:text-amber-400",
      )}>
        {reading ? formatValue(reading.value) : "Not reported"}
        {definition.unit && reading && (
          <span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">
            {definition.unit}
          </span>
        )}
        {definition.key === "vbat_mv" && reading && typeof reading.value === "number" && (
          <span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">
            ({(reading.value / 1000).toFixed(3)} V)
          </span>
        )}
        {stale && (
          <span className="ml-1 font-sans text-[10px] font-normal text-amber-700 dark:text-amber-400">
            (stale)
          </span>
        )}
      </span>
    </div>
  );
}

function MetricSection({
  title,
  description,
  metrics,
  data,
}: {
  title: string;
  description: string;
  metrics: MetricDefinition[];
  data: SolarPcbDeviceData;
}) {
  return (
    <section className="rounded-lg border border-border bg-background/65 p-3.5">
      <div className="mb-2.5 flex items-start gap-2.5">
        <div className="rounded-md bg-muted p-1.5">
          <BatteryCharging className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{description}</p>
        </div>
      </div>
      {metrics.map((metric) => (
        <MetricRow key={metric.key} definition={metric} reading={data.readings?.[metric.key]} />
      ))}
    </section>
  );
}

export function SolarPcbCard({ data }: { data: SolarPcbDeviceData }) {
  const [expanded, setExpanded] = useState(false);
  const readings = data.readings ?? {};
  const socReading = readings.soc_pct;
  const metrics = [...powerMetrics, ...electricalMetrics];
  const missingCount = metrics.filter(({ key }) => !readings[key]).length;
  const hasStaleTelemetry = Object.values(readings).some(
    (reading) => reading && isStale(reading.recordedAt),
  );
  const detailsId = `solar-pcb-details-${data.deviceId}`;
  const status = hasStaleTelemetry
    ? "Telemetry delayed"
    : metrics.some(({ key }) => readings[key])
      ? "Reporting"
      : "No data";
  const lastSeen = socReading?.recordedAt ?? data.lastUpdated;

  return (
    <Card
      data-testid="sensor-solar-pcb-card"
      data-device-id={data.deviceId}
      className={cn("overflow-hidden transition-shadow", expanded && "shadow-md")}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        className="group w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative rounded-md bg-muted p-2">
                <BatteryCharging className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div
                  className={cn(
                    "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                    hasStaleTelemetry ? "bg-amber-500" : status === "Reporting" ? "bg-green-500" : "bg-muted-foreground",
                  )}
                  aria-label={`Status: ${status}`}
                />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium">Solar PCB</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                  {data.deviceName}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium",
                hasStaleTelemetry
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                  : status === "Reporting"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                    : "bg-muted text-muted-foreground",
              )}>
                <span className={cn(
                  "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                  hasStaleTelemetry ? "bg-amber-500" : status === "Reporting" ? "bg-green-500" : "bg-muted-foreground",
                )} />
                {status}
              </span>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
              )}
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="flex items-baseline gap-1">
              <span
                className="font-mono text-3xl font-medium tracking-tight"
                data-testid="solar-pcb-card-value"
              >
                {socReading ? formatValue(socReading.value) : "Not reported"}
              </span>
              {socReading && <span className="text-sm text-muted-foreground">%</span>}
            </div>
            <div className="text-right">
              <p className={cn(
                "text-xs font-medium",
                hasStaleTelemetry ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
              )}>
                {hasStaleTelemetry ? "Last reported values" : "Battery state of charge"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {socReading ? "SOC updated" : "Board updated"} {formatAge(lastSeen)}
              </p>
            </div>
          </div>

          {!expanded && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                {readings.source ? `Source: ${formatValue(readings.source.value)}` : "Power source not reported"}
                {readings.charge && ` · Charge: ${formatValue(readings.charge.value)}`}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                View all PCB data
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          )}
        </CardContent>
      </button>

      {expanded && (
        <div id={detailsId} className="border-t border-border/70 px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Radio className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Latest Solar PCB telemetry · {data.deviceName}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Collapse Solar PCB details"
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              Close
            </button>
          </div>

          {hasStaleTelemetry && (
            <div className="mb-3 rounded-md bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Telemetry is delayed. Values marked stale are the last reported readings.
            </div>
          )}
          {missingCount > 0 && (
            <div className="mb-3 rounded-md bg-muted px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
              {missingCount} field{missingCount === 1 ? "" : "s"} not reported by this device. Missing values are shown as “Not reported”.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricSection
              title="Power state"
              description="Reported control and source fields"
              metrics={powerMetrics}
              data={data}
            />
            <MetricSection
              title="Electrical telemetry"
              description="Reported battery and bus measurements"
              metrics={electricalMetrics}
              data={data}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground sm:grid-cols-3">
            <span className="inline-flex items-center gap-1.5">
              <Radio className="h-3 w-3" aria-hidden="true" />
              {hasStaleTelemetry ? "Board telemetry delayed" : "Solar PCB telemetry"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BatteryCharging className="h-3 w-3" aria-hidden="true" />
              {readings.source ? `Source ${formatValue(readings.source.value)}` : "Source not reported"}
            </span>
            <span className="inline-flex items-center justify-end gap-1.5 font-mono">
              <Zap className="h-3 w-3" aria-hidden="true" />
              VBUS: {readings.vbus ? formatValue(readings.vbus.value) : "Not reported"}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
