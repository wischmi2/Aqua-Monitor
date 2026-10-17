import { isTemperatureDisplayUnit } from "@shared/temperature";
import { useTemperatureUnit } from "@/hooks/use-temperature-unit";
import { TemperatureUnitControl } from "@/components/temperature-unit-control";
import { displayTemperature, temperatureStatus } from "@/lib/temperature-display";
import { selectDashboardTemperatureReading, selectTemperatureReading } from "@shared/temperature-source";
import { PhPcbCard, SensorCard, type SensorStatus } from "@/components/sensor-card";
import { SolarPcbCard } from "@/components/solar-pcb-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import React, { useEffect, useState } from "react";
import { 
  Thermometer, 
  Gauge, 
  Droplets,
  Wind,
  Beaker,
  TestTube,
  Droplet,
  AlertTriangle,
  CheckCircle2,
  Settings2,
  Check,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SensorReading, Equipment, Device, PhPcbDeviceData, SolarPcbDeviceData, UserSettings } from "@shared/schema";
import { hasRecentHardwareReport } from "@shared/device-types";
import { useFlowUnit } from "@/hooks/use-flow-unit";

interface SensorConfig {
  type: string;
  label: string;
  icon: typeof Thermometer;
  unit: string;
  normalRange: [number, number];
  warningRange: [number, number];
}

const sensorConfigs: SensorConfig[] = [
  { type: "temperature", label: "Temperature", icon: Thermometer, unit: "°F", normalRange: [76, 82], warningRange: [74, 84] },
  { type: "salinity", label: "Salinity", icon: Gauge, unit: "ppt", normalRange: [34, 36], warningRange: [32, 38] },
  { type: "ammonia", label: "Ammonia", icon: Droplets, unit: "ppm", normalRange: [0, 0.02], warningRange: [0, 0.05] },
  { type: "nitrite", label: "Nitrite", icon: TestTube, unit: "ppm", normalRange: [0, 0.02], warningRange: [0, 0.1] },
  { type: "nitrate", label: "Nitrate", icon: Beaker, unit: "ppm", normalRange: [0, 20], warningRange: [0, 40] },
  { type: "dissolved_oxygen", label: "Dissolved O2", icon: Wind, unit: "mg/L", normalRange: [6, 8], warningRange: [5, 10] },
];

function getStatus(value: number, config: SensorConfig): SensorStatus {
  const [normMin, normMax] = config.normalRange;
  const [warnMin, warnMax] = config.warningRange;
  
  if (value >= normMin && value <= normMax) return "normal";
  if (value >= warnMin && value <= warnMax) return "warning";
  return "critical";
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function SensorSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

type TemperatureSourceOption = {
  id: string;
  name: string;
};

function TemperatureSourceControl({
  sourceDeviceId,
  savedSourceName,
  options,
  disabled,
  unavailable,
  hasAutomaticReading,
  onChange,
  fetchError,
  onRetryFetch,
  saveError,
  onRetrySave,
}: {
  sourceDeviceId: string | null;
  savedSourceName?: string;
  options: TemperatureSourceOption[];
  disabled: boolean;
  unavailable: boolean;
  hasAutomaticReading: boolean;
  onChange: (value: string | null) => void;
  fetchError?: string;
  onRetryFetch?: () => void;
  saveError?: string;
  onRetrySave?: () => void;
}) {
  const savedOptionMissing = sourceDeviceId !== null && !options.some((option) => option.id === sourceDeviceId);
  const unavailableName = savedSourceName ?? sourceDeviceId;

  return (
    <div className="space-y-2 border-t border-border/70 pt-3" data-testid="temperature-source-control">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor="temperature-source-select" className="text-xs font-medium text-foreground">
          Temperature source
        </label>
        <span className="text-[11px] text-muted-foreground">Choose the hardware for this reading</span>
      </div>
      <select
        id="temperature-source-select"
        data-testid="select-temperature-source"
        aria-describedby="temperature-source-help"
        value={sourceDeviceId ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">Automatic · latest reporting device</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
        {savedOptionMissing && sourceDeviceId && (
          <option value={sourceDeviceId}>
            Unavailable · {unavailableName} · …{sourceDeviceId.slice(-6)}
          </option>
        )}
      </select>
      <p id="temperature-source-help" className="text-[11px] leading-4 text-muted-foreground">
        {unavailable
          ? "This saved device has no eligible temperature report in the last hour. The measurement will return when it reports again, or you can choose another source."
          : sourceDeviceId === null && !hasAutomaticReading
            ? "No eligible temperature report is available yet. Automatic will use the newest report when one arrives."
            : "Only dashboard-enabled devices reporting temperature within the last hour can be selected."}
      </p>
      {fetchError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
          <span>{fetchError}</span>
          {onRetryFetch && (
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={onRetryFetch}>
              Retry
            </Button>
          )}
        </div>
      )}
      {saveError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
          <span>{saveError}</span>
          {onRetrySave && (
            <Button type="button" size="sm" variant="outline" className="h-7" onClick={onRetrySave}>
              Retry save
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DeviceConfigPanel({ eq, onClose }: { eq: Equipment; onClose: () => void }) {
  const { toast } = useToast();
  const [deviceId, setDeviceId] = useState(eq.goliothDeviceId ?? "");
  const [key, setKey] = useState(eq.goliothKey ?? "");

  const configMutation = useMutation({
    mutationFn: async () =>
      apiRequest("PATCH", `/api/equipment/${eq.id}`, {
        goliothDeviceId: deviceId.trim() || null,
        goliothKey: key.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({ title: "Saved", description: "Device config updated" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to save config", variant: "destructive" }),
  });

  return (
    <div className="border-t mt-1 pt-3 px-4 pb-3 space-y-3">
      <p className="text-xs text-muted-foreground">Link this sensor to a Golioth device</p>
      <div className="space-y-1">
        <Label className="text-xs">Golioth Device ID</Label>
        <Input
          data-testid={`input-device-id-${eq.id}`}
          placeholder="e.g. 6a34816d3f236bf1dbf8c75b"
          value={deviceId}
          onChange={e => setDeviceId(e.target.value)}
          className="h-8 text-xs font-mono"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Command Key</Label>
        <Input
          data-testid={`input-command-key-${eq.id}`}
          placeholder="e.g. solenoid"
          value={key}
          onChange={e => setKey(e.target.value)}
          className="h-8 text-xs"
        />
      </div>
      <div className="flex gap-2">
        <Button
          data-testid={`button-save-config-${eq.id}`}
          size="sm" className="h-7 text-xs"
          onClick={() => configMutation.mutate()}
          disabled={configMutation.isPending}
        >
          <Check className="h-3 w-3 mr-1" /> Save
        </Button>
        <Button
          data-testid={`button-cancel-config-${eq.id}`}
          size="sm" variant="ghost" className="h-7 text-xs"
          onClick={onClose}
        >
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

interface WaterFlowCardProps {
  flowRate: number;
  totalFlow: number;
  lastUpdated: string;
  equipment?: Equipment;
}

interface WaterDetectorCardProps {
  detected: boolean;
  hasData: boolean;
  lastUpdated: string;
  equipment?: Equipment;
}

function WaterDetectorCard({ detected, hasData, lastUpdated, equipment }: WaterDetectorCardProps) {
  const [configOpen, setConfigOpen] = useState(false);
  const hasDeviceConfig = !!(equipment?.goliothDeviceId && equipment?.goliothKey);

  return (
    <Card
      data-testid="sensor-water-detector"
      className={cn(
        "transition-all duration-500",
        detected && "border-red-500 shadow-md shadow-red-500/20"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "relative p-2 rounded-md transition-colors",
              detected ? "bg-red-100 dark:bg-red-950" : "bg-muted"
            )}>
              {detected ? (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {detected && (
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-red-500 animate-pulse" />
              )}
            </div>
            <span className="text-sm font-medium">Water Detector</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full",
              detected
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
            )}>
              {!hasData ? "No data" : detected ? "DETECTED" : "Clear"}
            </span>
            {equipment && (
              <button
                data-testid="button-config-water-detector"
                onClick={() => setConfigOpen(o => !o)}
                className={cn("p-1 rounded-md transition-colors", configOpen || hasDeviceConfig ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                title="Configure Golioth device"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-3xl font-mono font-medium tracking-tight",
              detected ? "text-red-500" : "text-green-500"
            )}
            data-testid="sensor-water-detector-value"
          >
            {!hasData ? "—" : detected ? "Water Present" : "No Water"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">Updated {lastUpdated}</p>
      </CardContent>
      {configOpen && equipment && (
        <DeviceConfigPanel eq={equipment} onClose={() => setConfigOpen(false)} />
      )}
    </Card>
  );
}

const MAX_DISPLAY_GPM = 2.64172; // ~10 L/min in GPM

function WaterFlowCard({ flowRate, totalFlow, lastUpdated, equipment }: WaterFlowCardProps) {
  const { unit, setUnit, convertRate, convertVolume, rateUnit, volumeUnit } = useFlowUnit();
  const [configOpen, setConfigOpen] = useState(false);
  const displayRate = convertRate(flowRate);
  const displayTotal = convertVolume(totalFlow);
  const maxDisplay = unit === "gallons" ? MAX_DISPLAY_GPM : 10;
  const pct = Math.min(100, (displayRate / maxDisplay) * 100);
  const isFlowing = flowRate > 0;
  const hasDeviceConfig = !!(equipment?.goliothDeviceId && equipment?.goliothKey);

  return (
    <Card data-testid="sensor-flow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative p-2 rounded-md bg-muted">
              <Droplet className={cn("h-4 w-4", isFlowing ? "text-blue-500" : "text-muted-foreground")} />
              <div
                className={cn(
                  "absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                  isFlowing ? "bg-blue-500 animate-pulse" : "bg-muted-foreground"
                )}
              />
            </div>
            <span className="text-sm font-medium">Water Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
              {isFlowing ? "flowing" : "idle"}
            </span>
            <button
              data-testid="button-flow-unit-toggle"
              onClick={() => setUnit(unit === "gallons" ? "liters" : "gallons")}
              className="text-xs font-medium px-2 py-0.5 rounded-full border border-border bg-background hover:bg-muted transition-colors"
              title="Switch unit"
            >
              {unit === "gallons" ? "gal" : "L"}
            </button>
            {equipment && (
              <button
                data-testid="button-config-water-flow"
                onClick={() => setConfigOpen(o => !o)}
                className={cn("p-1 rounded-md transition-colors", configOpen || hasDeviceConfig ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                title="Configure Golioth device"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-mono font-medium tracking-tight" data-testid="sensor-flow-rate-value">
                {displayRate.toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">{rateUnit}</span>
            </div>
          </div>
          <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
                isFlowing ? "bg-blue-500" : "bg-muted-foreground/30"
              )}
              style={{ width: `${pct}%` }}
              data-testid="sensor-flow-bar"
            />
            {isFlowing && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/30 animate-pulse"
                style={{ width: `${pct}%` }}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Total: <span className="font-mono font-medium text-foreground" data-testid="sensor-flow-total">{displayTotal.toFixed(3)} {volumeUnit}</span>
          </span>
          <span>Updated {lastUpdated}</span>
        </div>
      </CardContent>
      {configOpen && equipment && (
        <DeviceConfigPanel eq={equipment} onClose={() => setConfigOpen(false)} />
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { unit: temperatureUnit, setUnit: setTemperatureUnit } = useTemperatureUnit();
  // Expire cached cards even when a refetch fails or returns identical data.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: readings, isLoading } = useQuery<SensorReading[]>({
    queryKey: ["/api/sensors/latest"],
    refetchInterval: 30000,
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 30000,
  });

  const settingsQuery = useQuery<UserSettings>({
    queryKey: ["/api/user-settings"],
    refetchInterval: 30000,
  });
  const { toast } = useToast();
  const [failedTemperatureSource, setFailedTemperatureSource] = useState<string | null>(null);
  const temperatureSourceMutation = useMutation({
    mutationFn: async (temperatureSourceDeviceId: string | null) => {
      await apiRequest("PATCH", "/api/user-settings", { temperatureSourceDeviceId });
      return temperatureSourceDeviceId;
    },
    onSuccess: (temperatureSourceDeviceId) => {
      setFailedTemperatureSource(null);
      queryClient.setQueryData<UserSettings>(["/api/user-settings"], (current) =>
        current ? { ...current, temperatureSourceDeviceId } : current,
      );
      queryClient.invalidateQueries({ queryKey: ["/api/user-settings"] });
      toast({ title: "Temperature source saved", description: "Your dashboard will use this hardware for temperature." });
    },
    onError: (_error, temperatureSourceDeviceId) => {
      setFailedTemperatureSource(temperatureSourceDeviceId);
      toast({ title: "Could not save temperature source", description: "Your existing source remains active. Please retry.", variant: "destructive" });
    },
  });

  const { data: phPcbs, isLoading: isLoadingPhPcbs } = useQuery<PhPcbDeviceData[]>({
    queryKey: ["/api/sensors/ph-pcbs"],
    refetchInterval: 30000,
  });

  const { data: solarPcbs, isLoading: isLoadingSolarPcbs } = useQuery<SolarPcbDeviceData[]>({
    queryKey: ["/api/sensors/solar-pcbs"],
    refetchInterval: 30000,
  });

  const { data: equipment } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const equipmentMap = new Map<string, Equipment>();
  equipment?.forEach(eq => equipmentMap.set(eq.type, eq));

  const sensorDataMap = new Map<string, SensorReading>();
  readings?.forEach((reading) => {
    if (!hasRecentHardwareReport(reading.recordedAt, now)) return;
    const existing = sensorDataMap.get(reading.sensorType);
    if (!existing || new Date(reading.recordedAt) > new Date(existing.recordedAt)) {
      sensorDataMap.set(reading.sensorType, reading);
    }
  });

  const dashboardDeviceMap = new Map(
    (devices ?? [])
      .filter((device) => device.userId !== null && device.dashboardVisible === 1)
      .map((device) => [device.goliothDeviceId, device]),
  );
  const eligibleTemperatureReadings = (readings ?? []).filter((reading) =>
    reading.sensorType === "temperature"
      && !!reading.deviceId
      && dashboardDeviceMap.has(reading.deviceId)
      && hasRecentHardwareReport(reading.recordedAt, now),
  );
  const temperatureSourceId = settingsQuery.data?.temperatureSourceDeviceId ?? null;
  const temperatureSourceReady = !!settingsQuery.data && !settingsQuery.isError;
  const temperatureReading = temperatureSourceReady && devices && readings
    ? selectDashboardTemperatureReading(readings, devices, temperatureSourceId, now)
    : undefined;
  // All other sensor cards keep their existing latest-reading behavior.
  if (temperatureReading) sensorDataMap.set("temperature", temperatureReading);
  else sensorDataMap.delete("temperature");

  const temperatureSourceOptions: TemperatureSourceOption[] = Array.from(
    new Map(eligibleTemperatureReadings.map((reading) => {
      const device = reading.deviceId ? dashboardDeviceMap.get(reading.deviceId) : undefined;
      const id = reading.deviceId!;
      const name = device?.name ?? id;
      return [id, { id, name: `${name} · …${id.slice(-6)}` }] as const;
    })).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));
  const pinnedSourceUnavailable = temperatureSourceId !== null && temperatureSourceReady && !temperatureReading;
  const sourceControlDisabled = settingsQuery.isLoading
    || settingsQuery.isFetching
    || settingsQuery.isError
    || !devices
    || !readings
    || temperatureSourceMutation.isPending;
  const selectedSaveError = temperatureSourceMutation.isError
    ? "The source was not changed."
    : undefined;
  const temperatureSourceControl = temperatureSourceReady ? (
    <TemperatureSourceControl
      sourceDeviceId={temperatureSourceId}
      savedSourceName={devices?.find((device) => device.goliothDeviceId === temperatureSourceId)?.name}
      options={temperatureSourceOptions}
      disabled={sourceControlDisabled}
      unavailable={pinnedSourceUnavailable}
      hasAutomaticReading={!!selectTemperatureReading(eligibleTemperatureReadings, null, now)}
      onChange={(value) => temperatureSourceMutation.mutate(value)}
      saveError={selectedSaveError}
      onRetrySave={failedTemperatureSource !== null || temperatureSourceMutation.isError
        ? () => temperatureSourceMutation.mutate(failedTemperatureSource)
        : undefined}
    />
  ) : (
    <div className="space-y-2 border-t border-border/70 pt-3" data-testid="temperature-source-control">
      <p className="text-xs font-medium">Temperature source</p>
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{settingsQuery.isError ? "Unable to load your saved temperature source." : "Loading saved temperature source…"}</span>
        {settingsQuery.isError && (
          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => settingsQuery.refetch()}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );

  const recentPhPcbs = (phPcbs ?? []).filter((pcb) => hasRecentHardwareReport(pcb.lastUpdated, now));
  const recentSolarPcbs = (solarPcbs ?? []).filter((pcb) => hasRecentHardwareReport(pcb.lastUpdated, now));
  const rateReading = sensorDataMap.get("flow_rate_lpm");
  const totalReading = sensorDataMap.get("flow_liters");
  const detectorReading = sensorDataMap.get("water_present");
  const hasFlowReading = !!rateReading || !!totalReading;
  const hasDetectorReading = !!detectorReading;
  const recentStandardSensors = sensorConfigs
    .map((config) => ({ config, reading: sensorDataMap.get(config.type) }))
    .filter((item): item is { config: SensorConfig; reading: SensorReading } => !!item.reading);
  const visibleHardwareCardCount =
    recentPhPcbs.length +
    recentSolarPcbs.length +
    Number(hasFlowReading) +
    Number(hasDetectorReading) +
    recentStandardSensors.length;

  return (
    <div className="p-4 pb-24 md:pb-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Real-time sensor readings from your tank</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tank Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || isLoadingPhPcbs || isLoadingSolarPcbs ? (
            <div className="space-y-2" aria-label="Checking connected hardware">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          ) : visibleHardwareCardCount > 0 ? (
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">
                {visibleHardwareCardCount} recent hardware {visibleHardwareCardCount === 1 ? "reading" : "readings"} reporting
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No connected hardware has reported within the last hour.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading || isLoadingPhPcbs || isLoadingSolarPcbs ? (
          <>
            {Array.from({ length: 9 }).map((_, i) => (
              <SensorSkeleton key={i} />
            ))}
          </>
        ) : (
          <>
            {recentPhPcbs.map((pcb) => <PhPcbCard key={pcb.deviceId} data={pcb} />)}
            {recentSolarPcbs.map((pcb) => <SolarPcbCard key={pcb.deviceId} data={pcb} />)}
            {hasFlowReading && (() => {
              const lastSeen = rateReading?.recordedAt ?? totalReading?.recordedAt;
              return (
                <WaterFlowCard
                  flowRate={rateReading?.value ?? 0}
                  totalFlow={totalReading?.value ?? 0}
                  lastUpdated={lastSeen ? getTimeAgo(new Date(lastSeen)) : "No data"}
                  equipment={equipmentMap.get("water_control")}
                />
              );
            })()}
            {hasDetectorReading && (
              <WaterDetectorCard
                detected={detectorReading.value >= 1}
                hasData
                lastUpdated={getTimeAgo(new Date(detectorReading.recordedAt))}
                equipment={equipmentMap.get("water_control")}
              />
            )}
            {recentStandardSensors.map(({ config, reading }) => {
              const display = config.type === "temperature"
                ? displayTemperature(reading.value, reading.unit, temperatureUnit)
                : reading;
              const status = config.type === "temperature"
                ? temperatureStatus(reading.value, reading.unit) : getStatus(reading.value, config);
              const lastUpdated = getTimeAgo(new Date(reading.recordedAt));

              return (
                <SensorCard
                  key={config.type}
                  icon={config.icon}
                  label={config.label}
                  value={display.value}
                  unit={display.unit}
                  status={status}
                  lastUpdated={lastUpdated}
                  testId={`sensor-${config.type}`}
                  {...(config.type === "temperature" ? {
                    displayControl: isTemperatureDisplayUnit(reading.unit) ? (
                      <TemperatureUnitControl unit={temperatureUnit} onChange={setTemperatureUnit} testId="dashboard" />
                    ) : undefined,
                    sourceDeviceId: reading.deviceId,
                    sourceDeviceName: reading.deviceId
                      ? dashboardDeviceMap.get(reading.deviceId)?.name ?? reading.deviceId
                      : undefined,
                    sourceControl: temperatureSourceControl,
                  } : {})}
                />
              );
            })}
            {!temperatureReading && (
              <Card className="sm:col-span-2 lg:col-span-3" data-testid="temperature-source-recovery">
                <CardContent className="p-4">
                  {temperatureSourceControl}
                </CardContent>
              </Card>
            )}
            {visibleHardwareCardCount === 0 && (
              <Card className="sm:col-span-2 lg:col-span-3">
                <CardContent className="flex flex-col items-start gap-2 p-6">
                  <p className="font-medium">No recent sensor reports</p>
                  <p className="text-sm text-muted-foreground">
                    Hardware readings appear here only when a visible, connected device has reported within the last hour.
                  </p>
                  <a
                    href="/settings"
                    className="mt-1 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Review device settings
                  </a>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
