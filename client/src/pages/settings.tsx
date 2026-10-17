import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Moon, Sun, User, Shield, HelpCircle, Cpu, Check, X, Pencil, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Device, AlertSetting, UserSettings } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SENSOR_TYPES = [
  { value: "temperature", label: "Temperature", unit: "°F", isBoolean: false },
  { value: "salinity", label: "Salinity", unit: "ppt", isBoolean: false },
  { value: "ph", label: "pH", unit: "pH", isBoolean: false },
  { value: "ammonia", label: "Ammonia", unit: "ppm", isBoolean: false },
  { value: "nitrite", label: "Nitrite", unit: "ppm", isBoolean: false },
  { value: "nitrate", label: "Nitrate", unit: "ppm", isBoolean: false },
  { value: "dissolved_oxygen", label: "Dissolved Oxygen", unit: "mg/L", isBoolean: false },
  { value: "water_present", label: "Water Present", unit: "", isBoolean: true },
];

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [newAlertSensor, setNewAlertSensor] = useState("");
  const [newAlertMin, setNewAlertMin] = useState("");
  const [newAlertMax, setNewAlertMax] = useState("");
  const [newAlertBooleanValue, setNewAlertBooleanValue] = useState<"yes" | "no">("no");

  const { data: myDevices = [], isLoading: loadingMyDevices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: unclaimedDevices = [], isLoading: loadingUnclaimed } = useQuery<Device[]>({
    queryKey: ["/api/devices/unclaimed"],
  });

  const { data: userSettings } = useQuery<UserSettings>({
    queryKey: ["/api/user-settings"],
  });

  const { data: alertSettings = [] } = useQuery<AlertSetting[]>({
    queryKey: ["/api/alerts"],
  });

  const claimMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name?: string }) => {
      return apiRequest("POST", `/api/devices/${id}/claim`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/devices/unclaimed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/ph-pcbs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/solar-pcbs"] });
      toast({ title: "Device claimed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to claim device", variant: "destructive" });
    },
  });

  const unclaimMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/devices/${id}/unclaim`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/devices/unclaimed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/ph-pcbs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/solar-pcbs"] });
      toast({ title: "Device released" });
    },
    onError: () => {
      toast({ title: "Failed to release device", variant: "destructive" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return apiRequest("PATCH", `/api/devices/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/ph-pcbs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/solar-pcbs"] });
      setEditingDeviceId(null);
      toast({ title: "Device renamed" });
    },
    onError: () => {
      toast({ title: "Failed to rename device", variant: "destructive" });
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ id, dashboardVisible }: { id: number; dashboardVisible: number }) => {
      return apiRequest("PATCH", `/api/devices/${id}`, { dashboardVisible });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/ph-pcbs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sensors/solar-pcbs"] });
      toast({
        title: variables.dashboardVisible ? "Device shown on dashboard" : "Device hidden from dashboard",
        description: variables.dashboardVisible
          ? "Its device card will appear again."
          : "Its device card was removed. Device history is preserved.",
      });
    },
    onError: () => {
      toast({ title: "Failed to update dashboard visibility", variant: "destructive" });
    },
  });

  const updateUserSettingsMutation = useMutation({
    mutationFn: async (data: { phoneNumber?: string; alertsEnabled?: number; alertCooldownMinutes?: number }) => {
      return apiRequest("PATCH", "/api/user-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-settings"] });
      toast({ title: "Settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save settings", variant: "destructive" });
    },
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: { sensorType: string; minValue?: number | null; maxValue?: number | null }) => {
      return apiRequest("POST", "/api/alerts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setNewAlertSensor("");
      setNewAlertMin("");
      setNewAlertMax("");
      toast({ title: "Alert created" });
    },
    onError: () => {
      toast({ title: "Failed to create alert", variant: "destructive" });
    },
  });

  const updateAlertMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; minValue?: number | null; maxValue?: number | null; enabled?: number }) => {
      return apiRequest("PATCH", `/api/alerts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "Alert updated" });
    },
    onError: () => {
      toast({ title: "Failed to update alert", variant: "destructive" });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "Alert deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete alert", variant: "destructive" });
    },
  });

  const testSmsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/alerts/test-sms");
    },
    onSuccess: () => {
      toast({ title: "Test SMS sent!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send test SMS", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    if (userSettings?.phoneNumber) {
      setPhoneNumber(userSettings.phoneNumber);
    }
  }, [userSettings]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const userInitials = user 
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
    : "U";

  const startEditing = (device: Device) => {
    setEditingDeviceId(device.id);
    setEditingName(device.name);
  };

  const saveEdit = () => {
    if (editingDeviceId && editingName.trim()) {
      renameMutation.mutate({ id: editingDeviceId, name: editingName.trim() });
    }
  };

  const cancelEdit = () => {
    setEditingDeviceId(null);
    setEditingName("");
  };

  const formatLastSeen = (date: Date | null) => {
    if (!date) return "Never";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  const getSensorLabel = (sensorType: string) => {
    return SENSOR_TYPES.find(s => s.value === sensorType)?.label || sensorType;
  };

  const getSensorUnit = (sensorType: string) => {
    return SENSOR_TYPES.find(s => s.value === sensorType)?.unit || "";
  };

  const isBooleanSensor = (sensorType: string) => {
    return SENSOR_TYPES.find(s => s.value === sensorType)?.isBoolean || false;
  };

  const selectedSensorIsBoolean = newAlertSensor ? isBooleanSensor(newAlertSensor) : false;

  const availableSensors = SENSOR_TYPES.filter(
    s => !alertSettings.some(a => a.sensorType === s.value)
  );

  const handleSavePhone = () => {
    updateUserSettingsMutation.mutate({ phoneNumber });
  };

  const handleAddAlert = () => {
    if (!newAlertSensor) return;
    
    const isBoolean = isBooleanSensor(newAlertSensor);
    
    if (isBoolean) {
      createAlertMutation.mutate({
        sensorType: newAlertSensor,
        minValue: newAlertBooleanValue === "no" ? 0.5 : null,
        maxValue: newAlertBooleanValue === "yes" ? 0.5 : null,
      });
    } else {
      createAlertMutation.mutate({
        sensorType: newAlertSensor,
        minValue: newAlertMin ? parseFloat(newAlertMin) : null,
        maxValue: newAlertMax ? parseFloat(newAlertMax) : null,
      });
    }
  };

  const getBooleanAlertLabel = (alert: AlertSetting) => {
    if (alert.minValue !== null && alert.minValue > 0) {
      return "Alert when: No";
    } else if (alert.maxValue !== null && alert.maxValue < 1) {
      return "Alert when: Yes";
    }
    return "";
  };

  return (
    <div className="p-4 pb-24 md:pb-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Profile</CardTitle>
          </div>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium" data-testid="text-profile-name">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-profile-email">
                {user?.email}
              </p>
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input 
                id="firstName" 
                defaultValue={user?.firstName || ""} 
                disabled 
                data-testid="input-firstname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input 
                id="lastName" 
                defaultValue={user?.lastName || ""} 
                disabled 
                data-testid="input-lastname"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Profile information is managed through your Replit account
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Devices</CardTitle>
          </div>
          <CardDescription>Manage your connected IoT devices and dashboard visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-3">Your Devices</h4>
            {loadingMyDevices ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : myDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices claimed yet. Claim a device below to start receiving data.</p>
            ) : (
              <div className="space-y-2">
                {myDevices.map((device) => (
                  <div 
                    key={device.id} 
                    className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-md bg-muted/50"
                    data-testid={`device-row-${device.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      {editingDeviceId === device.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="h-8"
                            data-testid={`input-device-name-${device.id}`}
                          />
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={saveEdit}
                            disabled={renameMutation.isPending}
                            data-testid={`button-save-name-${device.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={cancelEdit}
                            data-testid={`button-cancel-edit-${device.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium truncate">{device.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            ID: {device.goliothDeviceId} | Last seen: {formatLastSeen(device.lastSeenAt)}
                          </p>
                        </>
                      )}
                    </div>
                    {editingDeviceId !== device.id && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="mr-1 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {device.dashboardVisible !== 0 ? "Shown on dashboard" : "Hidden from dashboard"}
                          </span>
                          <Switch
                            checked={device.dashboardVisible !== 0}
                            onCheckedChange={(checked) => visibilityMutation.mutate({
                              id: device.id,
                              dashboardVisible: checked ? 1 : 0,
                            })}
                            disabled={visibilityMutation.isPending}
                            aria-label={`${device.dashboardVisible !== 0 ? "Hide" : "Show"} ${device.name} on dashboard`}
                            data-testid={`switch-device-dashboard-${device.id}`}
                          />
                        </div>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => startEditing(device)}
                          data-testid={`button-edit-device-${device.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => unclaimMutation.mutate(device.id)}
                          disabled={unclaimMutation.isPending}
                          data-testid={`button-release-device-${device.id}`}
                        >
                          Release
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h4 className="font-medium mb-3">Available Devices</h4>
            <p className="text-xs text-muted-foreground mb-3">
              These devices have sent data but haven't been claimed yet. Claim one to link it to your account.
            </p>
            {loadingUnclaimed ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : unclaimedDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No unclaimed devices available. Connect your IoT device to Golioth and it will appear here.</p>
            ) : (
              <div className="space-y-2">
                {unclaimedDevices.map((device) => (
                  <div 
                    key={device.id} 
                    className="flex items-center justify-between gap-2 p-3 rounded-md border border-dashed"
                    data-testid={`unclaimed-device-row-${device.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{device.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        ID: {device.goliothDeviceId} | Last seen: {formatLastSeen(device.lastSeenAt)}
                      </p>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => claimMutation.mutate({ id: device.id })}
                      disabled={claimMutation.isPending}
                      data-testid={`button-claim-device-${device.id}`}
                    >
                      Claim
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">SMS Alerts</CardTitle>
          </div>
          <CardDescription>Get text messages when sensor readings go outside your thresholds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label>SMS Alerts Enabled</Label>
                <p className="text-sm text-muted-foreground">
                  Master switch for all SMS alerts
                </p>
              </div>
              <Switch
                checked={!!userSettings?.alertsEnabled}
                onCheckedChange={(checked) => updateUserSettingsMutation.mutate({ alertsEnabled: checked ? 1 : 0 })}
                data-testid="switch-sms-enabled"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <div className="flex gap-2">
                <Input
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1234567890"
                  className="flex-1"
                  data-testid="input-phone-number"
                />
                <Button 
                  onClick={handleSavePhone}
                  disabled={updateUserSettingsMutation.isPending}
                  data-testid="button-save-phone"
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +1 for US)
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => testSmsMutation.mutate()}
                disabled={testSmsMutation.isPending || !userSettings?.phoneNumber}
                data-testid="button-test-sms"
              >
                Send Test SMS
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Alert Thresholds</h4>
            <p className="text-sm text-muted-foreground">
              Set min/max values for each sensor. You'll get a text when readings go outside these limits.
            </p>

            {alertSettings.length > 0 && (
              <div className="space-y-2">
                {alertSettings.map((alert) => (
                  <div 
                    key={alert.id}
                    className="flex flex-wrap items-center gap-2 p-3 rounded-md bg-muted/50"
                    data-testid={`alert-row-${alert.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Switch
                        checked={!!alert.enabled}
                        onCheckedChange={(checked) => updateAlertMutation.mutate({ id: alert.id, enabled: checked ? 1 : 0 })}
                        data-testid={`switch-alert-${alert.id}`}
                      />
                      <span className="font-medium">{getSensorLabel(alert.sensorType)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isBooleanSensor(alert.sensorType) ? (
                        <span className="text-sm">{getBooleanAlertLabel(alert)}</span>
                      ) : (
                        <>
                          <span className="text-sm text-muted-foreground">Min:</span>
                          <span className="text-sm">{alert.minValue ?? "—"}{getSensorUnit(alert.sensorType)}</span>
                          <span className="text-sm text-muted-foreground">Max:</span>
                          <span className="text-sm">{alert.maxValue ?? "—"}{getSensorUnit(alert.sensorType)}</span>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteAlertMutation.mutate(alert.id)}
                        disabled={deleteAlertMutation.isPending}
                        data-testid={`button-delete-alert-${alert.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {availableSensors.length > 0 && (
              <div className="space-y-3 pt-2">
                <h5 className="text-sm font-medium">Add New Alert</h5>
                <div className="flex flex-wrap gap-2">
                  <Select value={newAlertSensor} onValueChange={(v) => {
                    setNewAlertSensor(v);
                    setNewAlertMin("");
                    setNewAlertMax("");
                    setNewAlertBooleanValue("no");
                  }}>
                    <SelectTrigger className="w-[180px]" data-testid="select-sensor-type">
                      <SelectValue placeholder="Select sensor" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSensors.map((sensor) => (
                        <SelectItem key={sensor.value} value={sensor.value}>
                          {sensor.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedSensorIsBoolean ? (
                    <Select value={newAlertBooleanValue} onValueChange={(v: "yes" | "no") => setNewAlertBooleanValue(v)}>
                      <SelectTrigger className="w-[140px]" data-testid="select-alert-boolean">
                        <SelectValue placeholder="Alert when" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Alert when: Yes</SelectItem>
                        <SelectItem value="no">Alert when: No</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={newAlertMin}
                        onChange={(e) => setNewAlertMin(e.target.value)}
                        className="w-20"
                        data-testid="input-alert-min"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={newAlertMax}
                        onChange={(e) => setNewAlertMax(e.target.value)}
                        className="w-20"
                        data-testid="input-alert-max"
                      />
                    </>
                  )}
                  
                  <Button
                    onClick={handleAddAlert}
                    disabled={!newAlertSensor || createAlertMutation.isPending}
                    data-testid="button-add-alert"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Alert Cooldown (minutes)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Minimum time between repeat alerts for the same sensor
            </p>
            <Select 
              value={String(userSettings?.alertCooldownMinutes || 30)} 
              onValueChange={(v) => updateUserSettingsMutation.mutate({ alertCooldownMinutes: parseInt(v) })}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-cooldown">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {theme === "light" ? (
              <Sun className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Moon className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle className="text-lg">Appearance</CardTitle>
          </div>
          <CardDescription>Customize how the app looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark themes
              </p>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={toggleTheme}
              data-testid="switch-dark-mode"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Security</CardTitle>
          </div>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your account is secured through Replit authentication. Manage your security settings in your Replit account.
          </p>
          <Button variant="outline" asChild data-testid="button-manage-account">
            <a href="https://replit.com/account" target="_blank" rel="noopener noreferrer">
              Manage Replit Account
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Help & Support</CardTitle>
          </div>
          <CardDescription>Get help with ReefWatch</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Need help with your tank monitor? Check our documentation or contact support.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" data-testid="button-documentation">
              Documentation
            </Button>
            <Button variant="outline" size="sm" data-testid="button-contact-support">
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
