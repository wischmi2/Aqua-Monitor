import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import {
  insertSensorReadingSchema,
  PH_PCB_SENSOR_TYPES,
  type AlertSetting,
  type PhPcbDeviceData,
  type PhPcbSensorType,
} from "@shared/schema";
import {
  groupPhPcbReadings,
  isPhPcbClassifierSensorType,
  resolveTelemetryTimestamp,
} from "./ph-pcb";
import { z } from "zod";
import twilio from "twilio";

// Helper to format sensor name for display
function formatSensorName(sensorType: string): string {
  const names: Record<string, string> = {
    temperature: "Temperature",
    salinity: "Salinity",
    ph: "pH",
    ammonia: "Ammonia",
    nitrite: "Nitrite",
    nitrate: "Nitrate",
    dissolved_oxygen: "Dissolved Oxygen",
    water_present: "Water Present",
  };
  return names[sensorType] || sensorType;
}

// Check alerts and send SMS if thresholds are exceeded
async function checkAndSendAlerts(
  userId: string,
  sensorType: string,
  value: number,
  unit: string
): Promise<void> {
  try {
    const userSettings = await storage.getUserSettings(userId);
    
    if (!userSettings?.alertsEnabled || !userSettings.phoneNumber) {
      return;
    }

    const alertSetting = await storage.getAlertSettingBySensor(userId, sensorType);
    
    if (!alertSetting || !alertSetting.enabled) {
      return;
    }

    // Check cooldown
    if (alertSetting.lastAlertAt) {
      const cooldownMs = (userSettings.alertCooldownMinutes || 30) * 60 * 1000;
      const timeSinceLastAlert = Date.now() - alertSetting.lastAlertAt.getTime();
      if (timeSinceLastAlert < cooldownMs) {
        return;
      }
    }

    // Check thresholds
    let alertMessage: string | null = null;
    const sensorName = formatSensorName(sensorType);

    if (alertSetting.minValue !== null && value < alertSetting.minValue) {
      alertMessage = `ReefWatch Alert: ${sensorName} is LOW at ${value}${unit} (min: ${alertSetting.minValue}${unit})`;
    } else if (alertSetting.maxValue !== null && value > alertSetting.maxValue) {
      alertMessage = `ReefWatch Alert: ${sensorName} is HIGH at ${value}${unit} (max: ${alertSetting.maxValue}${unit})`;
    }

    if (alertMessage) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !twilioPhone) {
        console.warn(`SMS alert would be sent for ${sensorType} but Twilio not configured (missing env vars)`);
        return;
      }

      const client = twilio(accountSid, authToken);
      
      await client.messages.create({
        body: alertMessage,
        from: twilioPhone,
        to: userSettings.phoneNumber,
      });

      await storage.updateAlertLastSent(alertSetting.id);
      console.log(`SMS alert sent for ${sensorType}: ${alertMessage}`);
    }
  } catch (error) {
    console.error("Error checking/sending alerts:", error);
  }
}

const goliothWebhookSchema = z.object({
  deviceId: z.string().optional(),
  device_id: z.string().optional(),
  timestamp: z.unknown().optional(),
  project_id: z.string().optional(),
  data: z.record(z.unknown()).optional(),
}).passthrough();

// Sensor mapping: defines all supported sensor types with their possible field names and units
const SENSOR_MAPPINGS = [
  { 
    sensorType: "temperature", 
    unit: "°F", 
    fieldNames: ["temp", "temperature", "Temperature", "TEMP", "temp_c", "tempC", "temp_celsius"],
    fieldTransforms: {
      temp_c: (c: number) => c * 9 / 5 + 32,
      tempC: (c: number) => c * 9 / 5 + 32,
      temp_celsius: (c: number) => c * 9 / 5 + 32,
    } as Record<string, (v: number) => number>,
  },
  { 
    sensorType: "salinity", 
    unit: "ppt", 
    fieldNames: ["salinity", "Salinity", "SALINITY", "salt"] 
  },
  { 
    sensorType: "ph", 
    unit: "pH", 
    fieldNames: ["ph", "pH", "PH", "pH Level", "ph_level", "phLevel"] 
  },
  {
    sensorType: "cal",
    unit: "point",
    fieldNames: ["cal"],
  },
  {
    sensorType: "mv",
    unit: "mV",
    fieldNames: ["mv"],
  },
  {
    sensorType: "temp_c",
    unit: "°C",
    fieldNames: ["temp_c", "tempC", "temp_celsius"],
  },
  {
    sensorType: "chg",
    unit: "",
    fieldNames: ["chg"],
  },
  {
    sensorType: "chg_stat",
    unit: "code",
    fieldNames: ["chg_stat"],
  },
  {
    sensorType: "die_c",
    unit: "°C",
    fieldNames: ["die_c"],
  },
  {
    sensorType: "err",
    unit: "code",
    fieldNames: ["err"],
  },
  {
    sensorType: "ma",
    unit: "mA",
    fieldNames: ["ma"],
  },
  {
    sensorType: "v",
    unit: "V",
    fieldNames: ["v"],
  },
  {
    sensorType: "vbus",
    unit: "",
    fieldNames: ["vbus"],
  },
  { 
    sensorType: "ammonia", 
    unit: "ppm", 
    fieldNames: ["ammonia", "Ammonia", "AMMONIA", "nh3", "NH3"] 
  },
  { 
    sensorType: "nitrite", 
    unit: "ppm", 
    fieldNames: ["nitrite", "Nitrite", "NITRITE", "no2", "NO2"] 
  },
  { 
    sensorType: "nitrate", 
    unit: "ppm", 
    fieldNames: ["nitrate", "Nitrate", "NITRATE", "no3", "NO3"] 
  },
  { 
    sensorType: "dissolved_oxygen", 
    unit: "mg/L", 
    fieldNames: ["dissolved_oxygen", "do", "DO", "dissolvedOxygen", "DissolvedOxygen", "oxygen", "o2", "O2"] 
  },
  { 
    sensorType: "water_present", 
    unit: "", 
    fieldNames: ["water_present", "waterPresent", "WaterPresent", "water", "water_detected", "waterDetected"] 
  },
  {
    sensorType: "flow_rate_lpm",
    unit: "L/min",
    fieldNames: ["flow_rate_lpm", "flowRateLpm", "flow_rate", "flowRate"]
  },
  {
    sensorType: "flow_liters",
    unit: "L",
    fieldNames: ["flow_liters", "flowLiters", "total_flow", "totalFlow"]
  },
];

// Helper function to convert value to number (handles booleans for binary sensors)
function toNumber(value: any): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return undefined;
}

// Helper function to extract sensor value from payload
// Golioth can nest the device data in several ways depending on pipeline config:
//   1. Root level:            payload.water_detected
//   2. data object:           payload.data.water_detected
//   3. data.value (LightDB Stream + inject-metadata): payload.data.value.water_detected
//   4. value object (no inject-metadata):             payload.value.water_detected
function extractSensorValue(
  payload: any,
  dataObj: any,
  fieldNames: string[],
  fieldTransforms?: Record<string, (v: number) => number>
): number | undefined {
  // Build the list of candidate objects to search, in priority order
  const candidates: any[] = [
    payload,                          // root level
    dataObj,                          // payload.data
    dataObj?.value,                   // payload.data.value  ← LightDB Stream + inject-metadata
    payload?.value,                   // payload.value       ← no inject-metadata
    dataObj?.data,                    // payload.data.data
  ].filter(Boolean);

  for (const fieldName of fieldNames) {
    for (const obj of candidates) {
      if (obj[fieldName] !== undefined) {
        const numValue = toNumber(obj[fieldName]);
        if (numValue !== undefined) {
          const transform = fieldTransforms?.[fieldName];
          return transform ? transform(numValue) : numValue;
        }
      }
    }
  }
  return undefined;
}

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

  app.get("/api/sensors/ph-pcbs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [readings, deviceList] = await Promise.all([
        storage.getSensorReadingsByTypes(userId, [...PH_PCB_SENSOR_TYPES]),
        storage.getDevices(userId),
      ]);
      res.json(groupPhPcbReadings(readings, deviceList));
    } catch (error) {
      console.error("Error fetching pH PCB readings:", error);
      res.status(500).json({ message: "Failed to fetch pH PCB readings" });
    }
  });

  app.get("/api/sensors/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sensorType = req.query.sensorType as string || "temperature";
      const timeRange = req.query.timeRange as string || "24h";
      
      let since = new Date();
      switch (timeRange) {
        case "60m":
          since.setMinutes(since.getMinutes() - 60);
          break;
        case "6h":
          since.setHours(since.getHours() - 6);
          break;
        case "12h":
          since.setHours(since.getHours() - 12);
          break;
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
      
      const allDefaults = [
        { userId, name: "Heater", type: "heater", isOn: 1, value: null, minValue: null, maxValue: null },
        { userId, name: "Filter Pump", type: "filter", isOn: 1, value: null, minValue: null, maxValue: null },
        { userId, name: "Tank Lights", type: "lights", isOn: 1, value: 75, minValue: 0, maxValue: 100 },
        { userId, name: "Wave Maker", type: "wavemaker", isOn: 1, value: 60, minValue: 0, maxValue: 100 },
        { userId, name: "Protein Skimmer", type: "skimmer", isOn: 1, value: null, minValue: null, maxValue: null },
        { userId, name: "Powerhead", type: "powerhead", isOn: 0, value: null, minValue: null, maxValue: null },
        { userId, name: "Water Control", type: "water_control", isOn: 0, value: null, minValue: null, maxValue: null },
      ];

      if (equipmentList.length === 0) {
        for (const eq of allDefaults) {
          await storage.createEquipment(eq);
        }
        equipmentList = await storage.getEquipment(userId);
      } else {
        // Add any missing equipment types (e.g. water_control for existing users)
        const existingTypes = new Set(equipmentList.map((e) => e.type));
        let added = false;
        for (const def of allDefaults) {
          if (!existingTypes.has(def.type)) {
            await storage.createEquipment(def);
            added = true;
          }
        }
        if (added) {
          equipmentList = await storage.getEquipment(userId);
        }
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
    goliothDeviceId: z.string().nullable().optional(),
    goliothKey: z.string().nullable().optional(),
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

      // If isOn is being toggled and equipment has a Golioth device configured, send command
      if (result.data.isOn !== undefined) {
        const isOnValue = result.data.isOn === 1;
        const apiKey = process.env.GOLIOTH_API_KEY;
        const projectId = process.env.GOLIOTH_PROJECT_ID;

        if (apiKey && projectId) {
          // Determine target device and key
          let targetDeviceId: string | null = updated.goliothDeviceId ?? null;
          let targetKey: string | null = updated.goliothKey ?? null;

          // Fallback for water_control without explicit config: use most recently seen real device
          if (!targetDeviceId && existingEquipment.type === "water_control") {
            const userDevices = await storage.getDevices(userId);
            const realDevices = userDevices
              .filter(d => /^[0-9a-f]{24}$/.test(d.goliothDeviceId))
              .sort((a, b) => new Date(b.lastSeenAt ?? 0).getTime() - new Date(a.lastSeenAt ?? 0).getTime());
            if (realDevices.length > 0) targetDeviceId = realDevices[0].goliothDeviceId;
            targetKey = "solenoid";
          }

          if (targetDeviceId && targetKey) {
            try {
              const lightdbUrl = `https://api.golioth.io/v1/projects/${projectId}/devices/${targetDeviceId}/data/desired`;
              const lightdbRes = await fetch(lightdbUrl, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "x-api-key": apiKey },
                body: JSON.stringify({ [targetKey]: isOnValue }),
              });
              if (lightdbRes.ok) {
                console.log(`Golioth LightDB: ${targetKey}=${isOnValue} on device ${targetDeviceId}`);
              } else {
                console.warn(`Golioth LightDB PUT failed: ${lightdbRes.status} ${await lightdbRes.text()}`);
              }
            } catch (lightdbErr) {
              console.error("Error writing to Golioth LightDB:", lightdbErr);
            }
          }
        } else {
          console.warn("GOLIOTH_API_KEY or GOLIOTH_PROJECT_ID not set — skipping Golioth write");
        }
      }

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
      const dataObj = payload.data as any;
      // ce-time is the authoritative CloudEvent measurement time. Legacy
      // payload timestamps remain a fallback for non-pH telemetry only.
      const rawCeTime = req.headers["ce-time"];
      const ceTime = Array.isArray(rawCeTime) ? rawCeTime[0] : rawCeTime;
      const legacyTimestamp = payload.timestamp
        ?? dataObj?.timestamp
        ?? dataObj?.time;
      const hasPhPcbTelemetry = SENSOR_MAPPINGS.some((mapping) => {
        if (!isPhPcbClassifierSensorType(mapping.sensorType)) return false;
        return extractSensorValue(
          payload,
          dataObj,
          mapping.fieldNames,
          (mapping as any).fieldTransforms,
        ) !== undefined;
      });
      const timestampResult = resolveTelemetryTimestamp({
        ceTime,
        legacyTimestamp,
        hasPhPcbTelemetry,
      });
      if (!timestampResult.ok) {
        console.warn(`Golioth webhook: ${timestampResult.message}`);
        return res.status(400).json({ message: timestampResult.message });
      }
      const { recordedAt } = timestampResult;
      // Log structure summary to help diagnose format issues
      console.log("Payload keys:", Object.keys(payload));
      if (dataObj) console.log("data keys:", Object.keys(dataObj));
      if (dataObj?.value && typeof dataObj.value === "object") console.log("data.value keys:", Object.keys(dataObj.value));
      if ((payload as any).value && typeof (payload as any).value === "object") console.log("value keys:", Object.keys((payload as any).value));
      console.log("Full payload:", JSON.stringify(payload, null, 2));

      // Golioth CloudEvents format sends device ID in ce-source header, not always in body
      const goliothDeviceId = payload.deviceId || payload.device_id
        || (dataObj as any)?.deviceId
        || (payload as any)?.value?.deviceId
        || (req.headers["ce-source"] as string);
      console.log("Extracted device ID:", goliothDeviceId, "(ce-source header:", req.headers["ce-source"], ")");
      
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

      const storedReadings: string[] = [];
      const receivedReadings: string[] = [];
      let waterDetected = false;

      // Process all sensor types
      for (const mapping of SENSOR_MAPPINGS) {
        const value = extractSensorValue(payload, dataObj, mapping.fieldNames, (mapping as any).fieldTransforms);
        
        if (value !== undefined) {
          if (device.userId) {
            await storage.createSensorReading({
              userId: device.userId,
              sensorType: mapping.sensorType,
              value: value,
              unit: mapping.unit,
              deviceId: goliothDeviceId,
              recordedAt,
            });
            storedReadings.push(`${mapping.sensorType}: ${value}${mapping.unit}`);
            
            if (mapping.sensorType === "water_present" && value >= 1) {
              waterDetected = true;
            }

            // Check alerts and send SMS if needed
            await checkAndSendAlerts(device.userId, mapping.sensorType, value, mapping.unit);
          } else {
            receivedReadings.push(`${mapping.sensorType}: ${value}${mapping.unit}`);
          }
        }
      }

      // Auto-shutoff: if water detected, always force water_control off and send Golioth command
      // (always fires regardless of DB state — physical device may be out of sync)
      if (waterDetected && device.userId) {
        const waterControl = await storage.getEquipmentByType(device.userId, "water_control");
        if (waterControl) {
          await storage.updateEquipment(waterControl.id, { isOn: 0 });
          console.log(`Auto-shutoff: water detected — forced water_control OFF for user ${device.userId} (was isOn=${waterControl.isOn})`);

          const apiKey = process.env.GOLIOTH_API_KEY;
          const projectId = process.env.GOLIOTH_PROJECT_ID;
          if (apiKey && projectId) {
            let targetDeviceId: string | null = waterControl.goliothDeviceId ?? null;
            let targetKey: string | null = waterControl.goliothKey ?? null;

            // Fallback: use most recently seen device OTHER than the water detector that triggered this
            if (!targetDeviceId) {
              const userDevices = await storage.getDevices(device.userId);
              const realDevices = userDevices
                .filter(d => /^[0-9a-f]{24}$/.test(d.goliothDeviceId) && d.goliothDeviceId !== goliothDeviceId)
                .sort((a, b) => new Date(b.lastSeenAt ?? 0).getTime() - new Date(a.lastSeenAt ?? 0).getTime());
              if (realDevices.length > 0) targetDeviceId = realDevices[0].goliothDeviceId;
              targetKey = "solenoid";
              console.log(`Auto-shutoff: fallback device selected: ${targetDeviceId} (excluded triggering device ${goliothDeviceId})`);
            }

            if (targetDeviceId && targetKey) {
              try {
                const lightdbUrl = `https://api.golioth.io/v1/projects/${projectId}/devices/${targetDeviceId}/data/desired`;
                const lightdbRes = await fetch(lightdbUrl, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json", "x-api-key": apiKey },
                  body: JSON.stringify({ [targetKey]: false }),
                });
                if (lightdbRes.ok) {
                  console.log(`Auto-shutoff: Golioth LightDB ${targetKey}=false sent to device ${targetDeviceId}`);
                } else {
                  console.warn(`Auto-shutoff: Golioth LightDB PUT failed: ${lightdbRes.status} ${await lightdbRes.text()}`);
                }
              } catch (lightdbErr) {
                console.error("Auto-shutoff: Error writing to Golioth LightDB:", lightdbErr);
              }
            }
          }
        }
      }


      if (storedReadings.length > 0) {
        console.log(`Golioth webhook: Stored readings from device ${goliothDeviceId}: ${storedReadings.join(", ")}`);
      }
      
      if (receivedReadings.length > 0) {
        console.log(`Golioth webhook: Received from unclaimed device ${goliothDeviceId} (not stored): ${receivedReadings.join(", ")}`);
      }

      res.json({ 
        success: true, 
        deviceId: goliothDeviceId, 
        claimed: !!device.userId,
        sensorsProcessed: storedReadings.length + receivedReadings.length,
        sensorsStored: storedReadings.length
      });
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

  // Diagnostic endpoint to verify Golioth connection
  app.get("/api/golioth-test", isAuthenticated, async (req: any, res) => {
    const apiKey = process.env.GOLIOTH_API_KEY;
    const projectId = process.env.GOLIOTH_PROJECT_ID;
    if (!apiKey || !projectId) {
      return res.json({ error: "Missing GOLIOTH_API_KEY or GOLIOTH_PROJECT_ID" });
    }
    try {
      const projectUrl = `https://api.golioth.io/v1/projects/${projectId}`;
      const projectRes = await fetch(projectUrl, { headers: { "x-api-key": apiKey } });
      const projectBody = await projectRes.json();

      const devicesUrl = `https://api.golioth.io/v1/projects/${projectId}/devices`;
      const devicesRes = await fetch(devicesUrl, { headers: { "x-api-key": apiKey } });
      const devicesBody = await devicesRes.json();

      res.json({
        projectId,
        projectStatus: projectRes.status,
        projectResponse: projectBody,
        devicesStatus: devicesRes.status,
        devicesResponse: devicesBody,
      });
    } catch (err: any) {
      res.json({ error: err.message });
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

  // Alert Settings API
  app.get("/api/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const alerts = await storage.getAlertSettings(userId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alert settings:", error);
      res.status(500).json({ message: "Failed to fetch alert settings" });
    }
  });

  app.post("/api/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { sensorType, minValue, maxValue, enabled } = req.body;
      
      if (!sensorType) {
        return res.status(400).json({ message: "sensorType is required" });
      }

      const existing = await storage.getAlertSettingBySensor(userId, sensorType);
      if (existing) {
        return res.status(409).json({ message: "Alert for this sensor type already exists" });
      }

      const alert = await storage.createAlertSetting({
        userId,
        sensorType,
        minValue: minValue ?? null,
        maxValue: maxValue ?? null,
        enabled: enabled ?? 1,
      });
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating alert:", error);
      res.status(500).json({ message: "Failed to create alert" });
    }
  });

  app.patch("/api/alerts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const { minValue, maxValue, enabled } = req.body;
      
      const alerts = await storage.getAlertSettings(userId);
      const alert = alerts.find(a => a.id === id);
      
      if (!alert) {
        return res.status(404).json({ message: "Alert not found" });
      }

      const updated = await storage.updateAlertSetting(id, {
        minValue: minValue ?? undefined,
        maxValue: maxValue ?? undefined,
        enabled: enabled ?? undefined,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(500).json({ message: "Failed to update alert" });
    }
  });

  app.delete("/api/alerts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      const alerts = await storage.getAlertSettings(userId);
      const alert = alerts.find(a => a.id === id);
      
      if (!alert) {
        return res.status(404).json({ message: "Alert not found" });
      }

      await storage.deleteAlertSetting(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  // User Settings API
  app.get("/api/user-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        settings = await storage.createUserSettings({
          userId,
          alertsEnabled: 1,
          alertCooldownMinutes: 30,
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ message: "Failed to fetch user settings" });
    }
  });

  app.patch("/api/user-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { phoneNumber, alertsEnabled, alertCooldownMinutes } = req.body;
      
      if (phoneNumber !== undefined && phoneNumber !== null && phoneNumber !== '') {
        const phoneRegex = /^\+[1-9]\d{6,14}$/;
        if (!phoneRegex.test(phoneNumber)) {
          return res.status(400).json({ message: "Invalid phone number format. Use E.164 format (e.g., +12025551234)" });
        }
      }
      
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        settings = await storage.createUserSettings({
          userId,
          phoneNumber: phoneNumber ?? null,
          alertsEnabled: alertsEnabled ?? 1,
          alertCooldownMinutes: alertCooldownMinutes ?? 30,
        });
      } else {
        settings = await storage.updateUserSettings(userId, {
          phoneNumber: phoneNumber !== undefined ? phoneNumber : undefined,
          alertsEnabled: alertsEnabled !== undefined ? alertsEnabled : undefined,
          alertCooldownMinutes: alertCooldownMinutes !== undefined ? alertCooldownMinutes : undefined,
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update user settings" });
    }
  });

  app.post("/api/alerts/test-sms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getUserSettings(userId);
      
      if (!settings?.phoneNumber) {
        return res.status(400).json({ message: "Phone number not configured" });
      }

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !twilioPhone) {
        return res.status(500).json({ message: "Twilio not configured" });
      }

      const client = twilio(accountSid, authToken);
      
      await client.messages.create({
        body: "ReefWatch Test: Your SMS alerts are working correctly!",
        from: twilioPhone,
        to: settings.phoneNumber,
      });

      res.json({ success: true, message: "Test SMS sent" });
    } catch (error: any) {
      console.error("Error sending test SMS:", error);
      res.status(500).json({ message: "Failed to send test SMS", error: error?.message });
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
        { type: "water_present", unit: "", baseValue: 1, variance: 0 },
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
