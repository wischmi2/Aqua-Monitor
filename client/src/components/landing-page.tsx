import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "./theme-toggle";
import { Droplets, Thermometer, Activity, Gauge } from "lucide-react";

export function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <Droplets className="h-6 w-6 text-primary" />
          <span className="font-medium text-lg">ReefWatch</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
              <Droplets className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">ReefWatch</CardTitle>
            <CardDescription className="text-base">
              Monitor your saltwater aquarium with real-time sensor data and smart controls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <Thermometer className="h-5 w-5 text-chart-1" />
                <span className="text-sm text-muted-foreground">Temperature</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <Gauge className="h-5 w-5 text-chart-2" />
                <span className="text-sm text-muted-foreground">Salinity</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <Activity className="h-5 w-5 text-chart-3" />
                <span className="text-sm text-muted-foreground">pH Level</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                <Droplets className="h-5 w-5 text-chart-4" />
                <span className="text-sm text-muted-foreground">Ammonia</span>
              </div>
            </div>

            <Button 
              className="w-full" 
              size="lg" 
              onClick={handleLogin}
              data-testid="button-login"
              aria-label="Sign in to dashboard"
            >
              Sign in to Dashboard
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Sign in with Google, GitHub, or email to access your tank dashboard
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="p-4 text-center text-sm text-muted-foreground border-t">
        Keep your reef healthy with real-time monitoring
      </footer>
    </div>
  );
}
