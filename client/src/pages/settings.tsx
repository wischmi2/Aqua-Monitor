import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Moon, Sun, User, Shield, HelpCircle, Cpu, Check, X, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Device } from "@shared/schema";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [editingDeviceId, setEditingDeviceId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: myDevices = [], isLoading: loadingMyDevices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: unclaimedDevices = [], isLoading: loadingUnclaimed } = useQuery<Device[]>({
    queryKey: ["/api/devices/unclaimed"],
  });

  const claimMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name?: string }) => {
      return apiRequest("POST", `/api/devices/${id}/claim`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/devices/unclaimed"] });
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
      setEditingDeviceId(null);
      toast({ title: "Device renamed" });
    },
    onError: () => {
      toast({ title: "Failed to rename device", variant: "destructive" });
    },
  });

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    if (stored) setTheme(stored);
  }, []);

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
          <CardDescription>Manage your connected IoT devices</CardDescription>
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
                    className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50"
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
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Notifications</CardTitle>
          </div>
          <CardDescription>Configure alert preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive alerts on your device
              </p>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
              data-testid="switch-notifications"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label>Critical Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when readings are critical
              </p>
            </div>
            <Switch
              checked={criticalAlerts}
              onCheckedChange={setCriticalAlerts}
              data-testid="switch-critical-alerts"
            />
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
