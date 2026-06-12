import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Flame, 
  Fan, 
  Lightbulb, 
  Waves,
  Droplets,
  Power,
  Droplet
} from "lucide-react";
import type { Equipment } from "@shared/schema";

interface EquipmentConfig {
  type: string;
  label: string;
  description: string;
  icon: typeof Flame;
  hasSlider?: boolean;
  sliderLabel?: string;
  sliderUnit?: string;
}

const equipmentConfigs: EquipmentConfig[] = [
  { type: "heater", label: "Heater", description: "Maintain water temperature", icon: Flame },
  { type: "filter", label: "Filter Pump", description: "Water filtration system", icon: Fan },
  { type: "lights", label: "Tank Lights", description: "LED lighting system", icon: Lightbulb, hasSlider: true, sliderLabel: "Brightness", sliderUnit: "%" },
  { type: "wavemaker", label: "Wave Maker", description: "Water circulation pump", icon: Waves, hasSlider: true, sliderLabel: "Flow Rate", sliderUnit: "%" },
  { type: "skimmer", label: "Protein Skimmer", description: "Remove organic waste", icon: Droplets },
  { type: "powerhead", label: "Powerhead", description: "Additional water flow", icon: Power },
  { type: "water_control", label: "Water Control", description: "Solenoid valve (open/closed)", icon: Droplet },
];

function EquipmentSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </CardHeader>
    </Card>
  );
}

export default function Controls() {
  const { toast } = useToast();

  const { data: equipment, isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isOn }: { id: number; isOn: boolean }) => {
      return apiRequest("PATCH", `/api/equipment/${id}`, { isOn: isOn ? 1 : 0 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update equipment",
        variant: "destructive",
      });
    },
  });

  const valueMutation = useMutation({
    mutationFn: async ({ id, value }: { id: number; value: number }) => {
      return apiRequest("PATCH", `/api/equipment/${id}`, { value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update equipment value",
        variant: "destructive",
      });
    },
  });

  const equipmentMap = new Map<string, Equipment>();
  equipment?.forEach((eq) => {
    equipmentMap.set(eq.type, eq);
  });

  return (
    <div className="p-4 pb-24 md:pb-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Controls</h1>
        <p className="text-muted-foreground">Manage your tank equipment</p>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {isLoading ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <EquipmentSkeleton key={i} />
            ))}
          </>
        ) : (
          equipmentConfigs.map((config) => {
            const eq = equipmentMap.get(config.type);
            const isOn = eq?.isOn === 1;
            const value = eq?.value ?? 50;

            return (
              <Card key={config.type}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-md ${isOn ? "bg-primary/10" : "bg-muted"}`}>
                        <config.icon className={`h-5 w-5 ${isOn ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                        <CardDescription className="text-sm">{config.description}</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={isOn}
                      onCheckedChange={(checked) => {
                        if (eq) {
                          toggleMutation.mutate({ id: eq.id, isOn: checked });
                        }
                      }}
                      disabled={!eq || toggleMutation.isPending}
                      data-testid={`switch-${config.type}`}
                    />
                  </div>
                </CardHeader>
                {config.hasSlider && isOn && eq && (
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm text-muted-foreground">
                          {config.sliderLabel}
                        </Label>
                        <span className="text-sm font-mono">
                          {Math.round(value)}{config.sliderUnit}
                        </span>
                      </div>
                      <Slider
                        value={[value]}
                        min={0}
                        max={100}
                        step={5}
                        onValueCommit={([newValue]) => {
                          valueMutation.mutate({ id: eq.id, value: newValue });
                        }}
                        disabled={valueMutation.isPending}
                        data-testid={`slider-${config.type}`}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
