import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  ChevronDown,
  ChevronUp,
  Gauge,
  Radio,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { PhPcbDeviceData, PhPcbSensorType, SensorReading } from "@shared/schema";

export type SensorStatus = "normal" | "warning" | "critical";

interface SensorCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  unit: string;
  status?: SensorStatus;
  lastUpdated?: string;
  trend?: "up" | "down" | "stable";
  testId?: string;
  sourceDeviceName?: string;
  sourceDeviceId?: string | null;
}

const statusIndicatorColors: Record<SensorStatus, string> = {
  normal: "bg-green-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

const statusBadgeVariants: Record<SensorStatus, "default" | "secondary" | "destructive"> = {
  normal: "default",
  warning: "secondary",
  critical: "destructive",
};

export function SensorCard({
  icon: Icon,
  label,
  value,
  unit,
  status = "normal",
  lastUpdated,
  testId,
  sourceDeviceName,
  sourceDeviceId,
}: SensorCardProps) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-md bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div 
                className={cn(
                  "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                  statusIndicatorColors[status]
                )}
                aria-label={`Status: ${status}`}
              />
            </div>
            <span className="text-sm font-medium">{label}</span>
          </div>
          <Badge variant={statusBadgeVariants[status]} className="text-xs capitalize">
            {status}
          </Badge>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-mono font-medium tracking-tight" data-testid={`${testId}-value`}>
            {typeof value === "number" ? value.toFixed(1) : value}
          </span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>

        {sourceDeviceName !== undefined || sourceDeviceId !== undefined ? (
          <div className="min-w-0 space-y-1 border-t border-border/70 pt-3">
            <p className="break-words text-xs font-medium text-foreground" data-testid="sensor-source-label">
              {sourceDeviceId ? `Source: ${sourceDeviceName || sourceDeviceId}` : "Source unavailable"}
            </p>
            <p className="break-all font-mono text-[11px] leading-4 text-muted-foreground" data-testid="sensor-source-id">
              {sourceDeviceId ? `Device ID: ${sourceDeviceId}` : "Source unavailable"}
            </p>
          </div>
        ) : null}

        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Updated {lastUpdated}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const PH_PCB_STALE_AFTER_MS = 5 * 60 * 1000;

type PhPcbMetricDefinition = {
  key: PhPcbSensorType;
  label: string;
  unit?: string;
  section: "ph" | "health";
};

const phPcbMetrics: PhPcbMetricDefinition[] = [
  { key: "ph", label: "pH level", unit: "pH", section: "ph" },
  { key: "cal", label: "Calibration", unit: "point", section: "ph" },
  { key: "mv", label: "Sensor signal", unit: "mV", section: "ph" },
  { key: "temp_c", label: "Water temperature", unit: "°C", section: "ph" },
  { key: "chg", label: "Charge state", section: "health" },
  { key: "chg_stat", label: "Charge status", unit: "code", section: "health" },
  { key: "die_c", label: "Die temperature", unit: "°C", section: "health" },
  { key: "err", label: "Error code", unit: "code", section: "health" },
  { key: "ma", label: "Current draw", unit: "mA", section: "health" },
  { key: "v", label: "Battery voltage", unit: "V", section: "health" },
  { key: "vbus", label: "VBUS", section: "health" },
];

export function formatPcbMetricValue(key: PhPcbSensorType, reading?: SensorReading): string {
  if (!reading) return "Not reported";

  if (key === "chg") return reading.value >= 1 ? "Charging" : "Not charging";
  if (key === "vbus") return reading.value >= 1 ? "Connected" : "Disconnected";
  if (key === "ph") return reading.value.toFixed(3);
  if (key === "mv" || key === "ma") return reading.value.toFixed(2);
  if (key === "v" || key === "temp_c" || key === "die_c") return reading.value.toFixed(1);
  return reading.value.toString();
}

export function isReadingStale(
  reading?: SensorReading,
  now = Date.now(),
): boolean {
  if (!reading) return false;
  return now - new Date(reading.recordedAt).getTime() > PH_PCB_STALE_AFTER_MS;
}

function formatAge(date?: Date | string | null): string {
  if (!date) return "No data";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function MetricRow({
  definition,
  reading,
}: {
  definition: PhPcbMetricDefinition;
  reading?: SensorReading;
}) {
  const missing = !reading;
  const stale = isReadingStale(reading);

  return (
    <div
      className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-b-0"
      data-testid={`ph-pcb-metric-${definition.key}`}
    >
      <span className="text-xs text-muted-foreground">{definition.label}</span>
      <span className={cn(
        "text-right font-mono text-xs font-medium",
        missing && "font-sans text-muted-foreground",
        stale && !missing && "text-amber-700 dark:text-amber-400",
      )}>
        {formatPcbMetricValue(definition.key, reading)}
        {definition.unit && reading && (
          <span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">
            {definition.unit}
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

function PcbSection({
  title,
  description,
  icon: Icon,
  metrics,
  readings,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  metrics: PhPcbMetricDefinition[];
  readings: PhPcbDeviceData["readings"];
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
      {metrics.map((metric) => (
        <MetricRow key={metric.key} definition={metric} reading={readings[metric.key]} />
      ))}
    </section>
  );
}

export function getPcbStatus(
  phReading?: SensorReading,
  now = Date.now(),
): SensorStatus | "delayed" | "no-data" {
  if (!phReading) return "no-data";
  if (isReadingStale(phReading, now)) return "delayed";
  if (phReading.value >= 8.0 && phReading.value <= 8.4) return "normal";
  if (phReading.value >= 7.8 && phReading.value <= 8.6) return "warning";
  return "critical";
}

const pcbStatusLabel: Record<SensorStatus | "delayed" | "no-data", string> = {
  normal: "Normal",
  warning: "Warning",
  critical: "Critical",
  delayed: "Telemetry delayed",
  "no-data": "No pH data",
};

const pcbStatusClasses: Record<SensorStatus | "delayed" | "no-data", string> = {
  normal: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  delayed: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  "no-data": "bg-muted text-muted-foreground",
};

export function PhPcbCard({ data }: { data: PhPcbDeviceData }) {
  const [expanded, setExpanded] = useState(false);
  const phReading = data.readings.ph;
  const status = getPcbStatus(phReading);
  const hasStaleTelemetry = Object.values(data.readings).some((reading) => isReadingStale(reading));
  const missingMetrics = phPcbMetrics.filter((metric) => !data.readings[metric.key]);
  const phMetrics = phPcbMetrics.filter((metric) => metric.section === "ph");
  const healthMetrics = phPcbMetrics.filter((metric) => metric.section === "health");
  const detailsId = `ph-pcb-details-${data.deviceId}`;

  const statusDescription = status === "critical"
    ? "Below target range"
    : status === "warning"
      ? "Outside normal range"
      : status === "delayed"
        ? "Last reported value · telemetry delayed"
        : status === "no-data"
          ? "pH not reported by this device"
          : "Within normal range";

  return (
    <Card
      data-testid="sensor-ph-pcb-card"
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
                <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div
                  className={cn(
                    "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                    status === "critical" ? "bg-red-500" : status === "warning" || status === "delayed" ? "bg-amber-500" : status === "normal" ? "bg-green-500" : "bg-muted-foreground",
                  )}
                  aria-label={`Status: ${pcbStatusLabel[status]}`}
                />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium">pH PCB</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                  {data.deviceName}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", pcbStatusClasses[status])}>
                <span className={cn(
                  "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                  status === "critical" ? "bg-red-500" : status === "warning" || status === "delayed" ? "bg-amber-500" : status === "normal" ? "bg-green-500" : "bg-muted-foreground",
                )} />
                {pcbStatusLabel[status]}
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
                className={cn(
                  "font-mono text-3xl font-medium tracking-tight",
                  status === "critical" ? "text-red-600" : status === "warning" ? "text-amber-600" : "text-foreground",
                )}
                data-testid="ph-card-value"
              >
                {formatPcbMetricValue("ph", phReading)}
              </span>
              {phReading && <span className="text-sm text-muted-foreground">pH</span>}
            </div>
            <div className="text-right">
              <p className={cn(
                "text-xs font-medium",
                status === "critical" ? "text-red-600" : status === "warning" || status === "delayed" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
              )}>
                {statusDescription}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {phReading ? "pH updated" : "Board updated"} {formatAge(phReading?.recordedAt ?? data.lastUpdated)}
              </p>
            </div>
          </div>

          {!expanded && (
            <div className="flex items-center justify-between border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <BatteryCharging className="h-3.5 w-3.5" aria-hidden="true" />
                {data.readings.chg ? formatPcbMetricValue("chg", data.readings.chg) : "Battery status not reported"}
                {data.readings.v && ` · ${formatPcbMetricValue("v", data.readings.v)} V`}
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
              Latest LightDB stream payload · {data.deviceName}
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Collapse pH PCB details"
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
          {missingMetrics.length > 0 && (
            <div className="mb-3 rounded-md bg-muted px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
              {missingMetrics.length} field{missingMetrics.length === 1 ? "" : "s"} not reported by this device. Missing values are shown as “Not reported”.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <PcbSection
              icon={Gauge}
              title="pH readings"
              description="Water quality measurements"
              metrics={phMetrics}
              readings={data.readings}
            />
            <PcbSection
              icon={BatteryCharging}
              title="Battery & board health"
              description="Power and board telemetry"
              metrics={healthMetrics}
              readings={data.readings}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground sm:grid-cols-4">
            <span className="inline-flex items-center gap-1.5">
              <Radio className="h-3 w-3" aria-hidden="true" />
              {hasStaleTelemetry ? "Board telemetry delayed" : "Board online"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3 w-3" aria-hidden="true" />
              pH PCB telemetry
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BatteryCharging className="h-3 w-3" aria-hidden="true" />
              {data.readings.vbus ? `VBUS ${formatPcbMetricValue("vbus", data.readings.vbus).toLowerCase()}` : "VBUS not reported"}
            </span>
            <span className="inline-flex items-center justify-end gap-1.5 font-mono">
              <Zap className="h-3 w-3" aria-hidden="true" />
              err: {data.readings.err ? formatPcbMetricValue("err", data.readings.err) : "—"}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
