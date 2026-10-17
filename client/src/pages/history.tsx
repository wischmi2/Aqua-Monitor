import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryDevice, HistoryReading, HistoryRange, HistorySensor } from "@shared/history";
import { hasRecentHistoryReport, HISTORY_RANGES } from "@shared/history";
import { useFlowUnit } from "@/hooks/use-flow-unit";
import { buildHistoryAxis, formatHistoryAxisTick } from "@/lib/history-axis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sensorColors = [
  "hsl(var(--chart-3))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-5))",
];
const FLOW_SENSOR_TYPES = ["flow_rate_lpm", "flow_liters"];

function dateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function displayValue(value: string | number | boolean) {
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    if (typeof body?.message === "string") return body.message;
    if (typeof body?.error === "string") return body.error;
  } catch {
    // Fall back to the HTTP status when the response has no JSON body.
  }
  return `${response.status}: ${response.statusText || "Unable to load history"}`;
}

export default function History() {
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedSensor, setSelectedSensor] = useState("");
  const [timeRange, setTimeRange] = useState<HistoryRange>("24h");
  const [chartWidth, setChartWidth] = useState(400);
  const [now, setNow] = useState(() => Date.now());
  const { unit, setUnit, convertRate, convertVolume, rateUnit, volumeUnit } = useFlowUnit();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const devicesQuery = useQuery<HistoryDevice[]>({
    queryKey: ["/api/sensors/history/devices"],
    queryFn: async () => {
      const response = await fetch("/api/sensors/history/devices", { credentials: "include" });
      if (!response.ok) throw new Error(await readError(response));
      return response.json();
    },
    refetchInterval: 30_000,
  });

  const activeDevices = useMemo(
    () => (devicesQuery.data ?? []).filter((device) => hasRecentHistoryReport(device.lastReportedAt, now)),
    [devicesQuery.data, now],
  );
  const resolvedDeviceId = activeDevices.some((device) => device.deviceId === selectedDevice)
    ? selectedDevice
    : activeDevices[0]?.deviceId ?? "";
  const activeDevice = activeDevices.find((device) => device.deviceId === resolvedDeviceId);
  const deviceSensors = activeDevice?.sensors ?? [];
  const resolvedSensorType = deviceSensors.some((sensor) => sensor.sensorType === selectedSensor)
    ? selectedSensor
    : deviceSensors[0]?.sensorType ?? "";
  const activeSensor = deviceSensors.find((sensor) => sensor.sensorType === resolvedSensorType);

  useEffect(() => {
    if (selectedDevice !== resolvedDeviceId) setSelectedDevice(resolvedDeviceId);
  }, [selectedDevice, resolvedDeviceId]);

  useEffect(() => {
    if (selectedSensor !== resolvedSensorType) setSelectedSensor(resolvedSensorType);
  }, [selectedSensor, resolvedSensorType]);

  const historyQuery = useQuery<HistoryReading[]>({
    queryKey: ["/api/sensors/history", resolvedDeviceId, resolvedSensorType, timeRange],
    enabled: Boolean(activeDevice && activeSensor && resolvedDeviceId && resolvedSensorType),
    refetchInterval: 30_000,
    queryFn: async () => {
      const params = new URLSearchParams({
        deviceId: resolvedDeviceId,
        sensorType: resolvedSensorType,
        timeRange,
      });
      const response = await fetch(`/api/sensors/history?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error(await readError(response));
      return response.json();
    },
  });

  const readings = useMemo(
    () => (historyQuery.data ?? [])
      .filter((reading) => reading.deviceId === resolvedDeviceId && reading.sensorType === resolvedSensorType)
      .slice()
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()),
    [historyQuery.data, resolvedDeviceId, resolvedSensorType],
  );
  const isFlowSensor = FLOW_SENSOR_TYPES.includes(resolvedSensorType);
  const displayUnit = isFlowSensor
    ? resolvedSensorType === "flow_rate_lpm" ? rateUnit : volumeUnit
    : activeSensor?.unit ?? "";
  const color = sensorColors[Math.max(0, deviceSensors.findIndex((sensor) => sensor.sensorType === resolvedSensorType) % sensorColors.length)];

  const numericReadings = readings.filter(
    (reading) => typeof reading.value === "number" && Number.isFinite(reading.value),
  );
  const hasNonNumericReading = readings.some(
    (reading) => typeof reading.value !== "number" || !Number.isFinite(reading.value),
  );
  const showEvents = activeSensor?.kind === "state" || hasNonNumericReading;
  const chartData = numericReadings.map((reading) => ({
    timestamp: new Date(reading.recordedAt).getTime(),
    value: convertReading(reading.value as number, resolvedSensorType, convertRate, convertVolume),
    fullTime: dateTime(reading.recordedAt),
  }));
  const historyAxis = useMemo(
    () => buildHistoryAxis(chartData.map((reading) => reading.timestamp), chartWidth),
    [chartData, chartWidth],
  );
  const recentReadings = numericReadings.slice(-10).reverse();
  const eventReadings = readings.slice().reverse();
  const hasSelection = Boolean(activeDevice && activeSensor);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-4 pb-24 pt-6 md:px-8 md:pb-10">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-8 -top-20 h-56 w-56 rounded-full border-[34px] border-primary/5" />
        <div className="relative">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Aquarium telemetry / archive</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">History</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Readings from your claimed boards, kept tied to the hardware that reported them.
          </p>
        </div>
      </header>

      {devicesQuery.isError && (
        <div
          role="alert"
          data-testid="history-devices-error"
          className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-medium">Couldn’t refresh connected boards</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{devicesQuery.error.message}</p>
          </div>
          <button
            type="button"
            onClick={() => void devicesQuery.refetch()}
            className="w-fit rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
            data-testid="button-retry-history-devices"
          >
            Retry
          </button>
        </div>
      )}

      {devicesQuery.isLoading ? (
        <section data-testid="history-devices-loading" aria-label="Loading connected boards" className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </section>
      ) : activeDevices.length === 0 ? (
        <section
          data-testid="history-no-active-devices"
          className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-14 text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span aria-hidden="true" className="h-3 w-3 rounded-full bg-current" />
          </div>
          <h2 className="text-lg font-semibold">No active boards in the last 24 hours</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            History only includes claimed hardware with a recent report. Once a board checks in, its recorded sensor types will appear here.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:p-5">
            <div className="min-w-0 space-y-2">
              <label htmlFor="history-device" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Reporting board
              </label>
              <Select value={resolvedDeviceId} onValueChange={setSelectedDevice}>
                <SelectTrigger id="history-device" className="h-11 w-full" data-testid="select-history-device" aria-label="Select reporting board">
                  <SelectValue placeholder="Choose a board" />
                </SelectTrigger>
                <SelectContent>
                  {activeDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.name || device.deviceId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <label htmlFor="history-sensor" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Recorded channel
              </label>
              <Select
                value={resolvedSensorType}
                onValueChange={setSelectedSensor}
                disabled={deviceSensors.length === 0}
              >
                <SelectTrigger id="history-sensor" className="h-11 w-full" data-testid="select-history-sensor" aria-label="Select recorded channel">
                  <SelectValue placeholder="No reported channels" />
                </SelectTrigger>
                <SelectContent>
                  {deviceSensors.map((sensor) => (
                    <SelectItem key={sensor.sensorType} value={sensor.sensorType}>
                      {sensor.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section aria-label="History time range" className="overflow-x-auto">
            <Tabs value={timeRange} onValueChange={(value) => setTimeRange(value as HistoryRange)}>
              <TabsList className="inline-flex h-auto min-w-full justify-start gap-1 rounded-xl bg-muted/70 p-1 sm:min-w-0">
                {HISTORY_RANGES.map((range) => (
                  <TabsTrigger
                    key={range}
                    value={range}
                    data-testid={`tab-${range}`}
                    className="rounded-lg px-4 py-2 text-sm"
                  >
                    {range}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </section>

          {!activeSensor ? (
            <section
              data-testid="history-no-sensors"
              className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center"
            >
              <h2 className="font-semibold">This board has no reported channels</h2>
              <p className="mt-2 text-sm text-muted-foreground">There are no recorded sensor types available to select.</p>
            </section>
          ) : (
            <>
              <Card className="overflow-hidden rounded-2xl">
                <CardHeader className="gap-4 border-b border-border/70 bg-muted/20 px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selected channel</p>
                      <CardTitle className="mt-1 text-xl">{activeSensor.label} history</CardTitle>
                    </div>
                    {isFlowSensor && (
                      <button
                        type="button"
                        data-testid="button-flow-unit-toggle-history"
                        onClick={() => setUnit(unit === "gallons" ? "liters" : "gallons")}
                        className="w-fit rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
                        aria-label={`Switch flow display to ${unit === "gallons" ? "liters" : "gallons"}`}
                      >
                        Displaying {unit === "gallons" ? "gallons" : "liters"} · switch to {unit === "gallons" ? "L" : "gal"}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-3">
                    <span className="text-muted-foreground">Source board</span>
                    <span className="min-w-0 break-words font-medium">{activeDevice?.name || "Unnamed board"}</span>
                    <span className="text-muted-foreground">Board ID</span>
                    <span className="min-w-0 break-all font-mono text-xs text-muted-foreground">{activeDevice?.deviceId}</span>
                    <span className="text-muted-foreground">Source</span>
                    <span className="font-medium">
                      {sourceName(activeSensor)} · last report {dateTime(activeDevice!.lastReportedAt)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {historyQuery.isLoading ? (
                    <div data-testid="history-readings-loading" aria-label="Loading history readings">
                      <Skeleton className="h-[280px] w-full rounded-xl" />
                    </div>
                  ) : historyQuery.isError ? (
                    <div
                      role="alert"
                      data-testid="history-readings-error"
                      className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/5 px-5 text-center"
                    >
                      <h2 className="font-semibold">History could not be loaded</h2>
                      <p className="mt-2 max-w-lg break-words text-sm text-muted-foreground">{historyQuery.error.message}</p>
                      <button
                        type="button"
                        onClick={() => void historyQuery.refetch()}
                        className="mt-4 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                        data-testid="button-retry-history-readings"
                      >
                        Retry
                      </button>
                    </div>
                  ) : !hasSelection || readings.length === 0 ? (
                    <div
                      data-testid="history-no-data"
                      className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-5 text-center"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">No recorded values</p>
                      <h2 className="mt-2 text-lg font-semibold">Nothing in this {timeRange} window</h2>
                      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                        This is an empty window, not an estimate. New readings from this board will appear here when reported.
                      </p>
                    </div>
                  ) : showEvents ? (
                    <div data-testid="history-state-events" className="space-y-3">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Reported events</p>
                          <p className="mt-1 text-sm text-muted-foreground">{eventReadings.length} actual {eventReadings.length === 1 ? "report" : "reports"} in range</p>
                        </div>
                        <span className="text-xs text-muted-foreground">Newest first</span>
                      </div>
                      <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                        {eventReadings.map((reading) => (
                          <li key={reading.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                            <time dateTime={reading.recordedAt} className="text-sm text-muted-foreground">{dateTime(reading.recordedAt)}</time>
                            <span className="break-words font-mono text-sm font-medium sm:text-right">
                              {displayValue(reading.value)}{reading.unit ? ` ${reading.unit}` : ""}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : chartData.length === 0 ? (
                    <div data-testid="history-no-numeric-data" className="flex min-h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
                      No numeric readings were reported in this {timeRange} window.
                    </div>
                  ) : (
                    <div data-testid="history-numeric-chart" className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%" onResize={(width) => setChartWidth(width)}>
                        <LineChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 5" className="stroke-muted" vertical={false} />
                          <XAxis
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={historyAxis.domain}
                            ticks={historyAxis.ticks}
                            tickFormatter={(value: number) => formatHistoryAxisTick(value, historyAxis.span)}
                            tick={{ fontSize: 11 }}
                            interval="preserveStartEnd"
                            padding={{ left: 8, right: 8 }}
                            tickMargin={10}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={68}
                            unit={` ${displayUnit}`}
                          />
                          <Tooltip
                            labelFormatter={(value) => dateTime(new Date(Number(value)).toISOString())}
                            formatter={(value: number) => [`${value.toFixed(2)} ${displayUnit}`, activeSensor.label]}
                            contentStyle={{
                              borderRadius: 12,
                              border: "1px solid hsl(var(--border))",
                              background: "hsl(var(--popover))",
                            }}
                          />
                          <Line
                            type="linear"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
                            activeDot={{ r: 5, strokeWidth: 0 }}
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {!historyQuery.isError && !showEvents && recentReadings.length > 0 && (
                <Card className="rounded-2xl">
                  <CardHeader className="flex flex-row items-end justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Latest observations</p>
                      <CardTitle className="mt-1 text-lg">Recent readings</CardTitle>
                    </div>
                    <span className="text-xs text-muted-foreground">Last {recentReadings.length} reports</span>
                  </CardHeader>
                  <CardContent className="px-5 pb-4 sm:px-6">
                    <ol className="divide-y divide-border">
                      {recentReadings.map((reading) => (
                        <li key={reading.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <time dateTime={reading.recordedAt} className="text-sm text-muted-foreground">{dateTime(reading.recordedAt)}</time>
                          <span className="font-mono text-sm font-medium">
                            {convertReading(reading.value as number, resolvedSensorType, convertRate, convertVolume).toFixed(2)} {displayUnit}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

function convertReading(
  value: number,
  sensorType: string,
  convertRate: (value: number) => number,
  convertVolume: (value: number) => number,
) {
  if (sensorType === "flow_rate_lpm") return convertRate(value);
  if (sensorType === "flow_liters") return convertVolume(value);
  return value;
}

function sourceName(sensor: HistorySensor) {
  return sensor.source === "solar" ? "Solar board" : "Sensor";
}
