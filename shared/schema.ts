import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";
import { users } from "./models/auth";

export const sensorReadings = pgTable("sensor_readings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  sensorType: text("sensor_type").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  deviceId: text("device_id"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const sensorReadingsRelations = relations(sensorReadings, ({ one }) => ({
  user: one(users, {
    fields: [sensorReadings.userId],
    references: [users.id],
  }),
}));

export const insertSensorReadingSchema = createInsertSchema(sensorReadings).omit({
  id: true,
});

export type InsertSensorReading = z.infer<typeof insertSensorReadingSchema>;
export type SensorReading = typeof sensorReadings.$inferSelect;

export const SOLAR_PCB_METRICS = [
  "aem", "aem_window", "charge", "ibat_ma", "soc_pct",
  "source", "usb_cc", "vbat_mv", "vbat_rise_mv", "vbus",
] as const;
export type SolarPcbMetric = typeof SOLAR_PCB_METRICS[number];
export type SolarPcbPayload = Partial<Record<SolarPcbMetric, number | string | boolean>>;
export interface SolarPcbDeviceData {
  deviceId: string;
  deviceName: string;
  lastUpdated: Date | null;
  readings: Partial<Record<SolarPcbMetric, {
    value: number | string | boolean;
    recordedAt: Date;
  }>>;
}

// Keep textual charger states and boolean flags intact rather than coercing
// them into the numeric sensor_readings table.
export const solarPcbReadings = pgTable("solar_pcb_readings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  payload: jsonb("payload").$type<SolarPcbPayload>().notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
});
export type SolarPcbReading = typeof solarPcbReadings.$inferSelect;
export type InsertSolarPcbReading = typeof solarPcbReadings.$inferInsert;

export const PH_PCB_SENSOR_TYPES = [
  "ph",
  "cal",
  "mv",
  "temp_c",
  "chg",
  "chg_stat",
  "die_c",
  "err",
  "ma",
  "v",
  "vbus",
] as const;

export type PhPcbSensorType = typeof PH_PCB_SENSOR_TYPES[number];

export interface PhPcbDeviceData {
  deviceId: string;
  deviceName: string;
  lastUpdated: Date | null;
  readings: Partial<Record<PhPcbSensorType, SensorReading>>;
}

export const tanks = pgTable("tanks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  volume: real("volume"),
  volumeUnit: text("volume_unit").default("gallons"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTankSchema = createInsertSchema(tanks).omit({
  id: true,
  createdAt: true,
});

export type InsertTank = z.infer<typeof insertTankSchema>;
export type Tank = typeof tanks.$inferSelect;

export const devices = pgTable("devices", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id"),
  tankId: integer("tank_id"),
  goliothDeviceId: text("golioth_device_id").notNull().unique(),
  name: text("name").notNull(),
  dashboardVisible: integer("dashboard_visible").default(1).notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const devicesRelations = relations(devices, ({ one }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
  tank: one(tanks, {
    fields: [devices.tankId],
    references: [tanks.id],
  }),
}));

export const insertDeviceSchema = createInsertSchema(devices).omit({
  id: true,
  lastSeenAt: true,
  createdAt: true,
});

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devices.$inferSelect;

export const equipment = pgTable("equipment", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  isOn: integer("is_on").default(0).notNull(),
  value: real("value"),
  minValue: real("min_value"),
  maxValue: real("max_value"),
  goliothDeviceId: text("golioth_device_id"),
  goliothKey: text("golioth_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

export const alertSettings = pgTable("alert_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull(),
  sensorType: text("sensor_type").notNull(),
  minValue: real("min_value"),
  maxValue: real("max_value"),
  enabled: integer("enabled").default(1).notNull(),
  lastAlertAt: timestamp("last_alert_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const alertSettingsRelations = relations(alertSettings, ({ one }) => ({
  user: one(users, {
    fields: [alertSettings.userId],
    references: [users.id],
  }),
}));

export const insertAlertSettingSchema = createInsertSchema(alertSettings).omit({
  id: true,
  lastAlertAt: true,
  createdAt: true,
});

export type InsertAlertSetting = z.infer<typeof insertAlertSettingSchema>;
export type AlertSetting = typeof alertSettings.$inferSelect;

export const userSettings = pgTable("user_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar("user_id").notNull().unique(),
  phoneNumber: text("phone_number"),
  alertsEnabled: integer("alerts_enabled").default(1).notNull(),
  alertCooldownMinutes: integer("alert_cooldown_minutes").default(30).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, {
    fields: [userSettings.userId],
    references: [users.id],
  }),
}));

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
