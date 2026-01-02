import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

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

        {lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Updated {lastUpdated}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
