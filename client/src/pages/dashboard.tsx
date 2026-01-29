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
  Waves
} from "lucide-react";
import type { SensorReading } from "@shared/schema";

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
  { type: "water_level", label: "Water Level", icon: Waves, unit: "%", normalRange: [80, 100], warningRange: [70, 100] },
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
            {Array.from({ length: 7 }).map((_, i) => (
              <SensorSkeleton key={i} />
            ))}
          </>
        ) : (
          sensorConfigs.map((config) => {
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
          })
        )}
      </div>
    </div>
  );
}
