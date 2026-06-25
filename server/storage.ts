import { eq, and, or, ne, lte, gte, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  items,
  bookings,
  pickupPoints,
  favorites,
  reviews,
  type User,
  type InsertUser,
  type Item,
  type InsertItem,
  type Booking,
  type InsertBooking,
  type PickupPoint,
  type InsertPickupPoint,
  type ReviewWithUser,
  type ReceiptBooking,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(id: string, data: Partial<Pick<User, "name" | "phone" | "city" | "preferredPickupPoint" | "notificationSettings">>): Promise<User | undefined>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  getProfileStats(userId: string): Promise<any>;

  // Items
  getItems(): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: string, data: Partial<InsertItem>): Promise<Item | undefined>;
  updateItemStatus(id: string, status: string): Promise<Item | undefined>;
  deleteItem(id: string): Promise<Item | undefined>;
  
  // Bookings
  getBookings(): Promise<(Booking & { item: Item; user: User })[]>;
  getBooking(id: string): Promise<(Booking & { item: Item }) | undefined>;
  getBookingsByUser(userId: string): Promise<(Booking & { item: Item })[]>;
  getBookingsByItem(itemId: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBookingStatus(id: string, status: string): Promise<Booking | undefined>;
  markBookingPaid(id: string, paymentMethod: "card" | "sbp"): Promise<Booking | undefined>;
  cancelBooking(id: string, withRefund: boolean): Promise<Booking | undefined>;
  completeDueRefunds(userId?: string): Promise<void>;
  hasActiveConfirmedBooking(itemId: string): Promise<boolean>;
  getAdminStats(): Promise<any>;
  checkAvailability(itemId: string, startDate: string, endDate: string, excludeBookingId?: string): Promise<boolean>;
  getAvailability(itemId: string): Promise<Booking[]>;
  getFavorites(userId: string): Promise<Item[]>;
  addFavorite(userId: string, itemId: string): Promise<void>;
  removeFavorite(userId: string, itemId: string): Promise<void>;
  getReviewsByItem(itemId: string): Promise<ReviewWithUser[]>;
  createReview(userId: string, itemId: string, bookingId: string, rating: number, text: string): Promise<any>;
  deleteReview(id: string): Promise<void>;
  getAllReviews(): Promise<(ReviewWithUser & { item: Item })[]>;
  canReview(userId: string, itemId: string, bookingId: string): Promise<boolean>;
  getReceiptBooking(id: string): Promise<ReceiptBooking | undefined>;


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

  async updateUserProfile(id: string, data: Partial<Pick<User, "name" | "phone" | "city" | "preferredPickupPoint" | "notificationSettings">>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ passwordHash }).where(eq(users.id, id)).returning();
    return updated;
  }

  async getProfileStats(userId: string) {
    const userBookings = await db.select().from(bookings).where(eq(bookings.userId, userId));
    const cancelled = new Set(["rejected", "cancelled", "Cancelled"]);
    return {
      totalBookings: userBookings.length,
      activeBookings: userBookings.filter((booking) => !cancelled.has(booking.status) && booking.status !== "completed" && booking.status !== "Completed").length,
      paidBookings: userBookings.filter((booking) => booking.paymentStatus === "paid" || booking.paymentStatus === "refunded").length,
      cancelledBookings: userBookings.filter((booking) => cancelled.has(booking.status)).length,
      paidBookingsAmount: userBookings.filter((booking) => booking.paymentStatus === "paid" || booking.paymentStatus === "refunded").reduce((sum, booking) => sum + booking.totalPrice + booking.deposit, 0),
    };
  }

  // Items
  async enrichItems(baseItems: Item[], userId?: string): Promise<Item[]> {
    const allReviews = await db.select().from(reviews);
    const allFavorites = await db.select().from(favorites);
    const favSet = new Set(allFavorites.filter((f) => f.userId === userId).map((f) => f.itemId));
    return baseItems.map((item) => {
      const itemReviews = allReviews.filter((r) => r.itemId === item.id);
      return {
        ...item,
        reviewsCount: itemReviews.length,
        averageRating: itemReviews.length ? itemReviews.reduce((sum, r) => sum + r.rating, 0) / itemReviews.length : 0,
        favoritesCount: allFavorites.filter((f) => f.itemId === item.id).length,
        isFavorite: favSet.has(item.id),
      };
    });
  }

  async getItems(): Promise<Item[]> {
    return this.enrichItems(await db.select().from(items));
  }

  async getItem(id: string): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id)).limit(1);
    return item ? (await this.enrichItems([item]))[0] : undefined;
  }

  async createItem(item: InsertItem): Promise<Item> {
    const [created] = await db.insert(items).values(item).returning();
    return created;
  }

  async updateItem(id: string, data: Partial<InsertItem>): Promise<Item | undefined> {
    const [updated] = await db.update(items).set(data).where(eq(items.id, id)).returning();
    return updated;
  }

  async updateItemStatus(id: string, status: string): Promise<Item | undefined> {
    const [updated] = await db.update(items).set({ status }).where(eq(items.id, id)).returning();
    return updated;
  }

  async deleteItem(id: string): Promise<Item | undefined> {
    const [deleted] = await db.delete(items).where(eq(items.id, id)).returning();
    return deleted;
  }

  // Bookings
  async getBookings(): Promise<(Booking & { item: Item; user: User })[]> {
    await this.completeDueRefunds();
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
    await this.completeDueRefunds();
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
    await this.completeDueRefunds(userId);
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

  async markBookingPaid(id: string, paymentMethod: "card" | "sbp"): Promise<Booking | undefined> {
    const [updated] = await db
      .update(bookings)
      .set({
        paymentStatus: "paid",
        paymentMethod,
        paidAt: new Date().toISOString(),
        refundStatus: null,
        refundRequestedAt: null,
        refundCompletedAt: null,
      })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }


  async cancelBooking(id: string, withRefund: boolean): Promise<Booking | undefined> {
    const now = new Date();
    const refundCompletedAt = new Date(now.getTime() + 2 * 60 * 1000);
    const [updated] = await db
      .update(bookings)
      .set(withRefund ? {
        status: "cancelled",
        paymentStatus: "refund_pending",
        refundStatus: "pending",
        refundRequestedAt: now.toISOString(),
        refundCompletedAt: refundCompletedAt.toISOString(),
      } : {
        status: "cancelled",
      })
      .where(eq(bookings.id, id))
      .returning();
    return updated;
  }

  async completeDueRefunds(userId?: string): Promise<void> {
    const conditions = [eq(bookings.refundStatus, "pending"), lte(bookings.refundCompletedAt, new Date().toISOString())];
    if (userId) conditions.push(eq(bookings.userId, userId));
    await db.update(bookings).set({ paymentStatus: "refunded", refundStatus: "refunded" }).where(and(...conditions));
  }

  async checkAvailability(itemId: string, startDate: string, endDate: string, excludeBookingId?: string): Promise<boolean> {
    const conditions = [
      eq(bookings.itemId, itemId),
      or(eq(bookings.status, "pending"), eq(bookings.status, "confirmed"), eq(bookings.status, "Paid"), eq(bookings.status, "Active"), eq(bookings.status, "Pending"), eq(bookings.paymentStatus, "paid")),
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


  async getAvailability(itemId: string): Promise<Booking[]> {
    const activeStatuses = ["pending", "confirmed", "Paid", "Active", "Pending"];
    const rows = await db.select().from(bookings).where(eq(bookings.itemId, itemId));
    return rows.filter((booking) => activeStatuses.includes(booking.status) || booking.paymentStatus === "paid");
  }

  async getFavorites(userId: string): Promise<Item[]> {
    const result = await db.select().from(favorites).innerJoin(items, eq(favorites.itemId, items.id)).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
    return this.enrichItems(result.map((row) => row.items), userId);
  }

  async addFavorite(userId: string, itemId: string): Promise<void> {
    await db.insert(favorites).values({ userId, itemId }).onConflictDoNothing();
  }

  async removeFavorite(userId: string, itemId: string): Promise<void> {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.itemId, itemId)));
  }

  async getReviewsByItem(itemId: string): Promise<ReviewWithUser[]> {
    const result = await db.select().from(reviews).innerJoin(users, eq(reviews.userId, users.id)).where(eq(reviews.itemId, itemId)).orderBy(desc(reviews.createdAt));
    return result.map((row) => ({ ...row.reviews, user: { id: row.users.id, name: row.users.name } }));
  }

  async canReview(userId: string, itemId: string, bookingId: string): Promise<boolean> {
    const [booking] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.userId, userId), eq(bookings.itemId, itemId))).limit(1);
    return !!booking && (booking.paymentStatus === "paid" || ["completed", "Completed", "Paid"].includes(booking.status));
  }

  async createReview(userId: string, itemId: string, bookingId: string, rating: number, text: string) {
    const [created] = await db.insert(reviews).values({ userId, itemId, bookingId, rating, text }).returning();
    return created;
  }

  async deleteReview(id: string): Promise<void> {
    await db.delete(reviews).where(eq(reviews.id, id));
  }

  async getAllReviews(): Promise<(ReviewWithUser & { item: Item })[]> {
    const result = await db.select().from(reviews).innerJoin(users, eq(reviews.userId, users.id)).innerJoin(items, eq(reviews.itemId, items.id)).orderBy(desc(reviews.createdAt));
    return result.map((row) => ({ ...row.reviews, user: { id: row.users.id, name: row.users.name }, item: row.items }));
  }

  async getReceiptBooking(id: string): Promise<ReceiptBooking | undefined> {
    const [result] = await db.select().from(bookings).innerJoin(items, eq(bookings.itemId, items.id)).innerJoin(users, eq(bookings.userId, users.id)).where(eq(bookings.id, id)).limit(1);
    return result ? { ...result.bookings, item: result.items, user: result.users } : undefined;
  }

  async hasActiveConfirmedBooking(itemId: string): Promise<boolean> {
    const active = await db.select().from(bookings).where(and(eq(bookings.itemId, itemId), eq(bookings.status, "confirmed"))).limit(1);
    return active.length > 0;
  }

  async getAdminStats() {
    const allItems = await db.select().from(items);
    const allBookings = await db.select().from(bookings);
    return {
      totalItems: allItems.length,
      availableItems: allItems.filter((item) => item.status === "available").length,
      bookedItems: allItems.filter((item) => item.status === "booked").length,
      unavailableItems: allItems.filter((item) => item.status === "unavailable").length,
      totalBookings: allBookings.length,
      pendingBookings: allBookings.filter((booking) => booking.status === "pending" || booking.status === "Pending").length,
      confirmedBookings: allBookings.filter((booking) => booking.status === "confirmed" || booking.status === "Paid" || booking.status === "Active").length,
      completedBookings: allBookings.filter((booking) => booking.status === "completed" || booking.status === "Completed").length,
      estimatedRevenue: allBookings
        .filter((booking) => ["confirmed", "completed", "Paid", "Active", "Completed"].includes(booking.status))
        .reduce((sum, booking) => sum + booking.totalPrice, 0),
      paidBookings: allBookings.filter((booking) => booking.paymentStatus === "paid").length,
      unpaidBookings: allBookings.filter((booking) => booking.paymentStatus !== "paid").length,
      paidBookingsAmount: allBookings
        .filter((booking) => booking.paymentStatus === "paid")
        .reduce((sum, booking) => sum + booking.totalPrice + booking.deposit, 0),
    };
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
