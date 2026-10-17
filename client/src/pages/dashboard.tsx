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
import { useEffect, useState } from "react";
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
import type { SensorReading, Equipment, Device, PhPcbDeviceData, SolarPcbDeviceData } from "@shared/schema";
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
              const value = reading.value;
              const status = getStatus(value, config);
              const lastUpdated = getTimeAgo(new Date(reading.recordedAt));

              return (
                <SensorCard
                  key={config.type}
                  icon={config.icon}
                  label={config.label}
                  value={value}
                  unit={config.unit}
                  status={status}
                  lastUpdated={lastUpdated}
                  testId={`sensor-${config.type}`}
                  {...(config.type === "temperature" ? {
                    sourceDeviceId: reading.deviceId,
                    sourceDeviceName: reading.deviceId
                      ? devices?.find((device) => device.goliothDeviceId === reading.deviceId)?.name ?? reading.deviceId
                      : undefined,
                  } : {})}
                />
              );
            })}
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
