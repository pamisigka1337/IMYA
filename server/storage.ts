import { eq, and, or, ne, lte, gte, desc } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  items,
  bookings,
  pickupPoints,
  type User,
  type InsertUser,
  type Item,
  type InsertItem,
  type Booking,
  type InsertBooking,
  type PickupPoint,
  type InsertPickupPoint,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Items
  getItems(): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: string, data: Partial<InsertItem>): Promise<Item | undefined>;
  
  // Bookings
  getBookings(): Promise<(Booking & { item: Item; user: User })[]>;
  getBooking(id: string): Promise<(Booking & { item: Item }) | undefined>;
  getBookingsByUser(userId: string): Promise<(Booking & { item: Item })[]>;
  getBookingsByItem(itemId: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBookingStatus(id: string, status: string): Promise<Booking | undefined>;
  checkAvailability(itemId: string, startDate: string, endDate: string, excludeBookingId?: string): Promise<boolean>;

  // Pickup Points
  getPickupPoints(): Promise<PickupPoint[]>;
  createPickupPoint(point: InsertPickupPoint): Promise<PickupPoint>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  // Items
  async getItems(): Promise<Item[]> {
    return db.select().from(items);
  }

  async getItem(id: string): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);
    return item;
  }

  async createItem(item: InsertItem): Promise<Item> {
    const [created] = await db.insert(items).values(item).returning();
    return created;
  }

  async updateItem(id: string, data: Partial<InsertItem>): Promise<Item | undefined> {
    const [updated] = await db.update(items).set(data).where(eq(items.id, id)).returning();
    return updated;
  }

  // Bookings
  async getBookings(): Promise<(Booking & { item: Item; user: User })[]> {
    const result = await db
      .select()
      .from(bookings)
      .innerJoin(items, eq(bookings.itemId, items.id))
      .innerJoin(users, eq(bookings.userId, users.id))
      .orderBy(desc(bookings.createdAt));

    return result.map((row) => ({
      ...row.bookings,
      item: row.items,
      user: row.users,
    }));
  }

  async getBooking(id: string): Promise<(Booking & { item: Item }) | undefined> {
    const [result] = await db
      .select()
      .from(bookings)
      .innerJoin(items, eq(bookings.itemId, items.id))
      .where(eq(bookings.id, id))
      .limit(1);

    if (!result) return undefined;

    return {
      ...result.bookings,
      item: result.items,
    };
  }

  async getBookingsByUser(userId: string): Promise<(Booking & { item: Item })[]> {
    const result = await db
      .select()
      .from(bookings)
      .innerJoin(items, eq(bookings.itemId, items.id))
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.createdAt));

    return result.map((row) => ({
      ...row.bookings,
      item: row.items,
    }));
  }

  async getBookingsByItem(itemId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.itemId, itemId));
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [created] = await db.insert(bookings).values(booking).returning();
    return created;
  }

  async updateBookingStatus(id: string, status: string): Promise<Booking | undefined> {
    const [updated] = await db.update(bookings).set({ status }).where(eq(bookings.id, id)).returning();
    return updated;
  }

  async checkAvailability(itemId: string, startDate: string, endDate: string, excludeBookingId?: string): Promise<boolean> {
    const conditions = [
      eq(bookings.itemId, itemId),
      ne(bookings.status, "Cancelled"),
      or(
        and(lte(bookings.startDate, startDate), gte(bookings.endDate, startDate)),
        and(lte(bookings.startDate, endDate), gte(bookings.endDate, endDate)),
        and(gte(bookings.startDate, startDate), lte(bookings.endDate, endDate))
      ),
    ];

    if (excludeBookingId) {
      conditions.push(ne(bookings.id, excludeBookingId));
    }

    const conflicts = await db
      .select()
      .from(bookings)
      .where(and(...conditions));

    return conflicts.length === 0;
  }

  // Pickup Points
  async getPickupPoints(): Promise<PickupPoint[]> {
    return db.select().from(pickupPoints);
  }

  async createPickupPoint(point: InsertPickupPoint): Promise<PickupPoint> {
    const [created] = await db.insert(pickupPoints).values(point).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
