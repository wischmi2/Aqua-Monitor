import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { insertSensorReadingSchema } from "@shared/schema";
import { z } from "zod";

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
