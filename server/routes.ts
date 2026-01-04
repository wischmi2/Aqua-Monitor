import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { insertSensorReadingSchema } from "@shared/schema";
import { z } from "zod";

const goliothWebhookSchema = z.object({
  deviceId: z.string().optional(),
  device_id: z.string().optional(),
  temp: z.number().optional(),
  temperature: z.number().optional(),
  timestamp: z.unknown().optional(),
  project_id: z.string().optional(),
  data: z.record(z.unknown()).optional(),
}).passthrough();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/sensors/latest", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const readings = await storage.getLatestSensorReadings(userId);
      res.json(readings);
    } catch (error) {
      console.error("Error fetching sensor readings:", error);
      res.status(500).json({ message: "Failed to fetch sensor readings" });
    }
  });

  app.get("/api/sensors/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sensorType = req.query.sensorType as string || "temperature";
      const timeRange = req.query.timeRange as string || "24h";
      
      let since = new Date();
      switch (timeRange) {
        case "24h":
          since.setHours(since.getHours() - 24);
          break;
        case "7d":
          since.setDate(since.getDate() - 7);
          break;
        case "30d":
          since.setDate(since.getDate() - 30);
          break;
        default:
          since.setHours(since.getHours() - 24);
      }
      
      const readings = await storage.getSensorHistory(userId, sensorType, since);
      res.json(readings);
    } catch (error) {
      console.error("Error fetching sensor history:", error);
      res.status(500).json({ message: "Failed to fetch sensor history" });
    }
  });

  app.post("/api/sensors", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertSensorReadingSchema.safeParse({ ...req.body, userId });
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid sensor reading data", errors: result.error.errors });
      }
      
      const reading = await storage.createSensorReading(result.data);
      res.status(201).json(reading);
    } catch (error) {
      console.error("Error creating sensor reading:", error);
      res.status(500).json({ message: "Failed to create sensor reading" });
    }
  });

  app.get("/api/equipment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let equipmentList = await storage.getEquipment(userId);
      
      if (equipmentList.length === 0) {
        const defaultEquipment = [
          { userId, name: "Heater", type: "heater", isOn: 1, value: null, minValue: null, maxValue: null },
          { userId, name: "Filter Pump", type: "filter", isOn: 1, value: null, minValue: null, maxValue: null },
          { userId, name: "Tank Lights", type: "lights", isOn: 1, value: 75, minValue: 0, maxValue: 100 },
          { userId, name: "Wave Maker", type: "wavemaker", isOn: 1, value: 60, minValue: 0, maxValue: 100 },
          { userId, name: "Protein Skimmer", type: "skimmer", isOn: 1, value: null, minValue: null, maxValue: null },
          { userId, name: "Powerhead", type: "powerhead", isOn: 0, value: null, minValue: null, maxValue: null },
        ];
        
        for (const eq of defaultEquipment) {
          await storage.createEquipment(eq);
        }
        
        equipmentList = await storage.getEquipment(userId);
      }
      
      res.json(equipmentList);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  const updateEquipmentSchema = z.object({
    isOn: z.number().min(0).max(1).optional(),
    value: z.number().min(0).max(100).optional(),
  });

  app.patch("/api/equipment/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const existingEquipment = await storage.getEquipmentById(id);
      if (!existingEquipment) {
        return res.status(404).json({ message: "Equipment not found" });
      }
      
      if (existingEquipment.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this equipment" });
      }
      
      const result = updateEquipmentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid update data", errors: result.error.errors });
      }
      
      const updated = await storage.updateEquipment(id, result.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating equipment:", error);
      res.status(500).json({ message: "Failed to update equipment" });
    }
  });

  app.post("/webhooks/golioth", async (req, res) => {
    try {
      console.log("=== GOLIOTH WEBHOOK DEBUG ===");
      console.log("Timestamp:", new Date().toISOString());
      console.log("Headers:", JSON.stringify(req.headers, null, 2));
      console.log("Raw Body:", JSON.stringify(req.body, null, 2));
      console.log("Content-Type:", req.headers["content-type"]);
      console.log("=============================");

      const webhookSecret = process.env.GOLIOTH_WEBHOOK_SECRET;
      const providedSecret = req.headers["x-webhook-secret"] || req.headers["authorization"];
      
      if (webhookSecret && providedSecret !== webhookSecret && providedSecret !== `Bearer ${webhookSecret}`) {
        console.warn("Golioth webhook: Invalid secret provided");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = goliothWebhookSchema.safeParse(req.body);
      if (!result.success) {
        console.error("Golioth webhook: Invalid payload", result.error.errors);
        console.log("Validation failed - returning 400");
        return res.status(400).json({ message: "Invalid payload", errors: result.error.errors });
      }

      const payload = result.data;
      console.log("Parsed payload:", JSON.stringify(payload, null, 2));
      const goliothDeviceId = payload.deviceId || payload.device_id || (payload.data as any)?.deviceId;
      console.log("Extracted device ID:", goliothDeviceId);
      
      if (!goliothDeviceId) {
        console.warn("Golioth webhook: No device ID in payload");
        return res.status(400).json({ message: "Device ID required" });
      }

      let device = await storage.getDeviceByGoliothId(goliothDeviceId);
      
      if (!device) {
        device = await storage.createUnclaimedDevice(goliothDeviceId);
        console.log(`Golioth webhook: Auto-created unclaimed device ${goliothDeviceId}`);
      }

      await storage.updateDeviceLastSeen(device.id);

      const temperature = payload.temp ?? payload.temperature ?? (payload.data as any)?.temp ?? (payload.data as any)?.temperature;
      
      if (temperature !== undefined && typeof temperature === "number" && device.userId) {
        await storage.createSensorReading({
          userId: device.userId,
          sensorType: "temperature",
          value: temperature,
          unit: "°F",
          deviceId: goliothDeviceId,
        });
        
        console.log(`Golioth webhook: Stored temp ${temperature}°F from device ${goliothDeviceId}`);
      } else if (temperature !== undefined && !device.userId) {
        console.log(`Golioth webhook: Received temp ${temperature}°F from unclaimed device ${goliothDeviceId} (data not stored until claimed)`);
      }

      res.json({ success: true, deviceId: goliothDeviceId, claimed: !!device.userId });
    } catch (error: any) {
      console.error("Golioth webhook error:", error);
      console.error("Error stack:", error?.stack);
      res.status(500).json({ 
        message: "Internal server error", 
        error: error?.message,
        stack: error?.stack?.split('\n').slice(0, 3).join('\n')
      });
    }
  });

  app.get("/api/devices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deviceList = await storage.getDevices(userId);
      res.json(deviceList);
    } catch (error) {
      console.error("Error fetching devices:", error);
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  app.post("/api/devices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { goliothDeviceId, name, tankId } = req.body;
      
      if (!goliothDeviceId || !name) {
        return res.status(400).json({ message: "goliothDeviceId and name are required" });
      }

      const existing = await storage.getDeviceByGoliothId(goliothDeviceId);
      if (existing) {
        return res.status(409).json({ message: "Device already registered" });
      }

      const device = await storage.createDevice({
        userId,
        goliothDeviceId,
        name,
        tankId: tankId || null,
      });

      res.status(201).json(device);
    } catch (error) {
      console.error("Error creating device:", error);
      res.status(500).json({ message: "Failed to register device" });
    }
  });

  app.get("/api/devices/unclaimed", isAuthenticated, async (req: any, res) => {
    try {
      const deviceList = await storage.getUnclaimedDevices();
      res.json(deviceList);
    } catch (error) {
      console.error("Error fetching unclaimed devices:", error);
      res.status(500).json({ message: "Failed to fetch unclaimed devices" });
    }
  });

  app.post("/api/devices/:id/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { name } = req.body;
      
      const device = await storage.getDeviceById(id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      
      if (device.userId) {
        return res.status(400).json({ message: "Device is already claimed" });
      }
      
      const claimed = await storage.claimDevice(id, userId, name);
      res.json(claimed);
    } catch (error) {
      console.error("Error claiming device:", error);
      res.status(500).json({ message: "Failed to claim device" });
    }
  });

  app.post("/api/devices/:id/unclaim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const device = await storage.getDeviceById(id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      
      if (device.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to unclaim this device" });
      }
      
      const unclaimed = await storage.unclaimDevice(id);
      res.json(unclaimed);
    } catch (error) {
      console.error("Error unclaiming device:", error);
      res.status(500).json({ message: "Failed to unclaim device" });
    }
  });

  app.patch("/api/devices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { name } = req.body;
      
      const device = await storage.getDeviceById(id);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }
      
      if (device.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this device" });
      }
      
      const updated = await storage.updateDevice(id, { name });
      res.json(updated);
    } catch (error) {
      console.error("Error updating device:", error);
      res.status(500).json({ message: "Failed to update device" });
    }
  });

  app.post("/api/sensors/seed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sensorTypes = [
        { type: "temperature", unit: "°F", baseValue: 78, variance: 2 },
        { type: "salinity", unit: "ppt", baseValue: 35, variance: 1 },
        { type: "ph", unit: "pH", baseValue: 8.2, variance: 0.2 },
        { type: "ammonia", unit: "ppm", baseValue: 0.01, variance: 0.005 },
        { type: "nitrite", unit: "ppm", baseValue: 0.01, variance: 0.01 },
        { type: "nitrate", unit: "ppm", baseValue: 10, variance: 5 },
        { type: "dissolved_oxygen", unit: "mg/L", baseValue: 7, variance: 1 },
      ];

      const readings = [];
      const now = Date.now();

      for (let i = 0; i < 48; i++) {
        const recordedAt = new Date(now - i * 30 * 60 * 1000);
        
        for (const sensor of sensorTypes) {
          const value = sensor.baseValue + (Math.random() - 0.5) * 2 * sensor.variance;
          readings.push({
            userId,
            sensorType: sensor.type,
            value: parseFloat(value.toFixed(3)),
            unit: sensor.unit,
          });
        }
      }

      for (const reading of readings) {
        await storage.createSensorReading(reading);
      }

      res.json({ message: "Seed data created", count: readings.length });
    } catch (error) {
      console.error("Error seeding data:", error);
      res.status(500).json({ message: "Failed to seed data" });
    }
  });

  return httpServer;
}
