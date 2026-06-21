import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import type { SensorReading } from "@shared/schema";
import { useFlowUnit } from "@/hooks/use-flow-unit";

const FLOW_SENSOR_TYPES = ["flow_rate_lpm", "flow_liters"];

const sensorOptions = [
  { value: "temperature", label: "Temperature", unit: "°F", color: "hsl(var(--chart-1))" },
  { value: "salinity", label: "Salinity", unit: "ppt", color: "hsl(var(--chart-2))" },
  { value: "ph", label: "pH Level", unit: "pH", color: "hsl(var(--chart-3))" },
  { value: "ammonia", label: "Ammonia", unit: "ppm", color: "hsl(var(--chart-4))" },
  { value: "nitrite", label: "Nitrite", unit: "ppm", color: "hsl(var(--chart-5))" },
  { value: "nitrate", label: "Nitrate", unit: "ppm", color: "hsl(var(--chart-1))" },
  { value: "dissolved_oxygen", label: "Dissolved O2", unit: "mg/L", color: "hsl(var(--chart-2))" },
  { value: "flow_rate_lpm", label: "Water Flow", unit: "L/min", color: "hsl(var(--chart-3))" },
  { value: "flow_liters", label: "Total Flow", unit: "L", color: "hsl(var(--chart-4))" },
];

function formatDate(dateStr: string | Date) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(dateStr: string | Date) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function History() {
  const [selectedSensor, setSelectedSensor] = useState("temperature");
  const [timeRange, setTimeRange] = useState("24h");

  const { data: readings, isLoading } = useQuery<SensorReading[]>({
    queryKey: ["/api/sensors/history", selectedSensor, timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/sensors/history?sensorType=${selectedSensor}&timeRange=${timeRange}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  const { unit, setUnit, convertRate, convertVolume, rateUnit, volumeUnit } = useFlowUnit();
  const isFlowSensor = FLOW_SENSOR_TYPES.includes(selectedSensor);

  const selectedConfig = sensorOptions.find((s) => s.value === selectedSensor);

  function getDisplayUnit() {
    if (selectedSensor === "flow_rate_lpm") return rateUnit;
    if (selectedSensor === "flow_liters") return volumeUnit;
    return selectedConfig?.unit ?? "";
  }

  function convertValue(raw: number) {
    if (selectedSensor === "flow_rate_lpm") return convertRate(raw);
    if (selectedSensor === "flow_liters") return convertVolume(raw);
    return raw;
  }

  const useTimeFormat = ["60m", "6h", "12h", "24h"].includes(timeRange);

  const chartData = readings
    ?.filter((r) => r.sensorType === selectedSensor)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map((r) => ({
      time: useTimeFormat ? formatTime(r.recordedAt) : formatDate(r.recordedAt),
      value: convertValue(r.value),
      fullTime: new Date(r.recordedAt).toLocaleString(),
    })) ?? [];

  return (
    <div className="p-4 pb-24 md:pb-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-muted-foreground">View historical sensor data</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={selectedSensor} onValueChange={setSelectedSensor}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-sensor">
            <SelectValue placeholder="Select sensor" />
          </SelectTrigger>
          <SelectContent>
            {sensorOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs value={timeRange} onValueChange={setTimeRange} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="60m" data-testid="tab-60m">60m</TabsTrigger>
            <TabsTrigger value="6h" data-testid="tab-6h">6h</TabsTrigger>
            <TabsTrigger value="12h" data-testid="tab-12h">12h</TabsTrigger>
            <TabsTrigger value="24h" data-testid="tab-24h">24h</TabsTrigger>
            <TabsTrigger value="7d" data-testid="tab-7d">7d</TabsTrigger>
            <TabsTrigger value="30d" data-testid="tab-30d">30d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {selectedConfig?.label} History
            </CardTitle>
            {isFlowSensor && (
              <button
                data-testid="button-flow-unit-toggle-history"
                onClick={() => setUnit(unit === "gallons" ? "liters" : "gallons")}
                className="text-xs font-medium px-2 py-1 rounded-md border border-border bg-background hover:bg-muted transition-colors"
                title="Switch unit"
              >
                {unit === "gallons" ? "gal" : "L"}
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data available for this time range
            </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="time" 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 12 }}
                    unit={` ${getDisplayUnit()}`}
                    width={60}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border border-border rounded-md p-2 shadow-md">
                            <p className="text-xs text-muted-foreground">{payload[0].payload.fullTime}</p>
                            <p className="text-sm font-medium">
                              {payload[0].value} {getDisplayUnit()}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={selectedConfig?.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Readings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chartData.slice(-10).reverse().map((reading, i) => (
                <div 
                  key={i} 
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <span className="text-sm text-muted-foreground">{reading.fullTime}</span>
                  <span className="font-mono text-sm">
                    {reading.value.toFixed(2)} {selectedConfig?.unit}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
