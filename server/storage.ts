import { 
  sensorReadings, 
  equipment,
  tanks,
  devices,
  type SensorReading, 
  type InsertSensorReading,
  type Equipment,
  type InsertEquipment,
  type Tank,
  type InsertTank,
  type Device,
  type InsertDevice
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, isNull } from "drizzle-orm";

export interface IStorage {
  getSensorReadings(userId: string): Promise<SensorReading[]>;
  getLatestSensorReadings(userId: string): Promise<SensorReading[]>;
  getSensorHistory(userId: string, sensorType: string, since: Date): Promise<SensorReading[]>;
  createSensorReading(reading: InsertSensorReading): Promise<SensorReading>;

  getEquipment(userId: string): Promise<Equipment[]>;
  getEquipmentById(id: number): Promise<Equipment | undefined>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment | undefined>;

  getTanks(userId: string): Promise<Tank[]>;
  createTank(tank: InsertTank): Promise<Tank>;

  getDevices(userId: string): Promise<Device[]>;
  getDeviceById(id: number): Promise<Device | undefined>;
  getDeviceByGoliothId(goliothDeviceId: string): Promise<Device | undefined>;
  getUnclaimedDevices(): Promise<Device[]>;
  createDevice(device: InsertDevice): Promise<Device>;
  createUnclaimedDevice(goliothDeviceId: string): Promise<Device>;
  claimDevice(id: number, userId: string, name?: string): Promise<Device | undefined>;
  unclaimDevice(id: number): Promise<Device | undefined>;
  updateDevice(id: number, data: { name?: string }): Promise<Device | undefined>;
  updateDeviceLastSeen(id: number): Promise<Device | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getSensorReadings(userId: string): Promise<SensorReading[]> {
    return db
      .select()
      .from(sensorReadings)
      .where(eq(sensorReadings.userId, userId))
      .orderBy(desc(sensorReadings.recordedAt));
  }

  async getLatestSensorReadings(userId: string): Promise<SensorReading[]> {
    return db
      .select()
      .from(sensorReadings)
      .where(eq(sensorReadings.userId, userId))
      .orderBy(desc(sensorReadings.recordedAt))
      .limit(50);
  }

  async getSensorHistory(userId: string, sensorType: string, since: Date): Promise<SensorReading[]> {
    return db
      .select()
      .from(sensorReadings)
      .where(
        and(
          eq(sensorReadings.userId, userId),
          eq(sensorReadings.sensorType, sensorType),
          gte(sensorReadings.recordedAt, since)
        )
      )
      .orderBy(desc(sensorReadings.recordedAt));
  }

  async createSensorReading(reading: InsertSensorReading): Promise<SensorReading> {
    const [created] = await db.insert(sensorReadings).values(reading).returning();
    return created;
  }

  async getEquipment(userId: string): Promise<Equipment[]> {
    return db.select().from(equipment).where(eq(equipment.userId, userId));
  }

  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    const [eq_item] = await db.select().from(equipment).where(eq(equipment.id, id));
    return eq_item;
  }

  async createEquipment(eq: InsertEquipment): Promise<Equipment> {
    const [created] = await db.insert(equipment).values(eq).returning();
    return created;
  }

  async updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    const [updated] = await db
      .update(equipment)
      .set(data)
      .where(eq(equipment.id, id))
      .returning();
    return updated;
  }

  async getTanks(userId: string): Promise<Tank[]> {
    return db.select().from(tanks).where(eq(tanks.userId, userId));
  }

  async createTank(tank: InsertTank): Promise<Tank> {
    const [created] = await db.insert(tanks).values(tank).returning();
    return created;
  }

  async getDevices(userId: string): Promise<Device[]> {
    return db.select().from(devices).where(eq(devices.userId, userId));
  }

  async getDeviceById(id: number): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async getDeviceByGoliothId(goliothDeviceId: string): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.goliothDeviceId, goliothDeviceId));
    return device;
  }

  async getUnclaimedDevices(): Promise<Device[]> {
    return db.select().from(devices).where(isNull(devices.userId)).orderBy(desc(devices.lastSeenAt));
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const [created] = await db.insert(devices).values(device).returning();
    return created;
  }

  async createUnclaimedDevice(goliothDeviceId: string): Promise<Device> {
    const [created] = await db.insert(devices).values({
      goliothDeviceId,
      name: `Device ${goliothDeviceId.slice(-6)}`,
      userId: null,
    }).returning();
    return created;
  }

  async claimDevice(id: number, userId: string, name?: string): Promise<Device | undefined> {
    const updateData: { userId: string; name?: string } = { userId };
    if (name) updateData.name = name;
    
    const [updated] = await db
      .update(devices)
      .set(updateData)
      .where(eq(devices.id, id))
      .returning();
    return updated;
  }

  async unclaimDevice(id: number): Promise<Device | undefined> {
    const [updated] = await db
      .update(devices)
      .set({ userId: null })
      .where(eq(devices.id, id))
      .returning();
    return updated;
  }

  async updateDevice(id: number, data: { name?: string }): Promise<Device | undefined> {
    const [updated] = await db
      .update(devices)
      .set(data)
      .where(eq(devices.id, id))
      .returning();
    return updated;
  }

  async updateDeviceLastSeen(id: number): Promise<Device | undefined> {
    const [updated] = await db
      .update(devices)
      .set({ lastSeenAt: new Date() })
      .where(eq(devices.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
