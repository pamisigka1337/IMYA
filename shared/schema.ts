import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const registerSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

export const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const items = pgTable("items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  brand: text("brand").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  size: text("size").notNull(),
  pricePerDay: integer("price_per_day").notNull(),
  deposit: integer("deposit").notNull(),
  images: json("images").$type<string[]>().notNull().default([]),
  condition: text("condition").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
});

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

export const bookings = pgTable("bookings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  itemId: varchar("item_id", { length: 36 }).notNull().references(() => items.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: integer("days").notNull(),
  totalPrice: integer("total_price").notNull(),
  deposit: integer("deposit").notNull(),
  status: text("status").notNull().default("Pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
});

export const createBookingSchema = z.object({
  itemId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const pickupPoints = pgTable("pickup_points", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  city: text("city").notNull(),
  address: text("address").notNull(),
  hours: text("hours").notNull(),
  phone: text("phone").notNull(),
});

export const insertPickupPointSchema = createInsertSchema(pickupPoints).omit({
  id: true,
});

export type InsertPickupPoint = z.infer<typeof insertPickupPointSchema>;
export type PickupPoint = typeof pickupPoints.$inferSelect;

export const BOOKING_STATUSES = ["Pending", "Paid", "Active", "Completed", "Cancelled"] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

export const updateItemSchema = z.object({
  brand: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  pricePerDay: z.number().min(1).optional(),
  deposit: z.number().min(0).optional(),
  condition: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const createItemSchema = z.object({
  brand: z.string().min(1, "Укажите бренд"),
  title: z.string().min(1, "Укажите название"),
  category: z.string().min(1, "Выберите категорию"),
  size: z.string().min(1, "Укажите размер"),
  pricePerDay: z.number().min(1, "Укажите цену"),
  deposit: z.number().min(0, "Укажите залог"),
  condition: z.string().min(1, "Укажите состояние"),
  description: z.string().min(1, "Добавьте описание"),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export type BookingWithItem = Booking & { item: Item };
