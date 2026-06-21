import { SensorCard, type SensorStatus } from "@/components/sensor-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { 
  Thermometer, 
  Gauge, 
  Activity, 
  Droplets,
  Wind,
  Beaker,
  TestTube,
  Droplet,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SensorReading } from "@shared/schema";
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
  { type: "ph", label: "pH Level", icon: Activity, unit: "pH", normalRange: [8.1, 8.4], warningRange: [7.8, 8.6] },
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

interface WaterFlowCardProps {
  flowRate: number;
  totalFlow: number;
  lastUpdated: string;
}

interface WaterDetectorCardProps {
  detected: boolean;
  hasData: boolean;
  lastUpdated: string;
}

function WaterDetectorCard({ detected, hasData, lastUpdated }: WaterDetectorCardProps) {
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
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            detected
              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
              : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
          )}>
            {!hasData ? "No data" : detected ? "DETECTED" : "Clear"}
          </span>
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
    </Card>
  );
}

const MAX_DISPLAY_GPM = 2.64172; // ~10 L/min in GPM

function WaterFlowCard({ flowRate, totalFlow, lastUpdated }: WaterFlowCardProps) {
  const { unit, setUnit, convertRate, convertVolume, rateUnit, volumeUnit } = useFlowUnit();
  const displayRate = convertRate(flowRate);
  const displayTotal = convertVolume(totalFlow);
  const maxDisplay = unit === "gallons" ? MAX_DISPLAY_GPM : 10;
  const pct = Math.min(100, (displayRate / maxDisplay) * 100);
  const isFlowing = flowRate > 0;

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
    </Card>
  );
}

export default function Dashboard() {
  const { data: readings, isLoading } = useQuery<SensorReading[]>({
    queryKey: ["/api/sensors/latest"],
    refetchInterval: 30000,
  });

  const sensorDataMap = new Map<string, SensorReading>();
  readings?.forEach((reading) => {
    const existing = sensorDataMap.get(reading.sensorType);
    if (!existing || new Date(reading.recordedAt) > new Date(existing.recordedAt)) {
      sensorDataMap.set(reading.sensorType, reading);
    }
  });

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
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-muted-foreground">All systems operational</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            {Array.from({ length: 9 }).map((_, i) => (
              <SensorSkeleton key={i} />
            ))}
          </>
        ) : (
          <>
            {(() => {
              const rateReading = sensorDataMap.get("flow_rate_lpm");
              const totalReading = sensorDataMap.get("flow_liters");
              const lastSeen = rateReading?.recordedAt ?? totalReading?.recordedAt;
              return (
                <WaterFlowCard
                  flowRate={rateReading?.value ?? 0}
                  totalFlow={totalReading?.value ?? 0}
                  lastUpdated={lastSeen ? getTimeAgo(new Date(lastSeen)) : "No data"}
                />
              );
            })()}
            {(() => {
              const detectorReading = sensorDataMap.get("water_present");
              return (
                <WaterDetectorCard
                  detected={detectorReading ? detectorReading.value >= 1 : false}
                  hasData={!!detectorReading}
                  lastUpdated={detectorReading ? getTimeAgo(new Date(detectorReading.recordedAt)) : "No data"}
                />
              );
            })()}
            {sensorConfigs.map((config) => {
              const reading = sensorDataMap.get(config.type);
              const value = reading?.value ?? 0;
              const status = getStatus(value, config);
              const lastUpdated = reading?.recordedAt 
                ? getTimeAgo(new Date(reading.recordedAt))
                : "No data";

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
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
