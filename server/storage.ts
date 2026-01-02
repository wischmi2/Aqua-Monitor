import { 
  sensorReadings, 
  equipment,
  tanks,
  type SensorReading, 
  type InsertSensorReading,
  type Equipment,
  type InsertEquipment,
  type Tank,
  type InsertTank
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
