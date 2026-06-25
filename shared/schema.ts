import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
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

export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const items = sqliteTable("items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  brand: text("brand").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  size: text("size").notNull(),
  pricePerDay: integer("price_per_day").notNull(),
  deposit: integer("deposit").notNull(),
  images: text("images", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  condition: text("condition").notNull(),
  description: text("description").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  status: text("status").notNull().default("available"),
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
});

export type InsertItem = typeof items.$inferInsert;
export type Item = typeof items.$inferSelect;

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  itemId: text("item_id").notNull().references(() => items.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: integer("days").notNull(),
  totalPrice: integer("total_price").notNull(),
  deposit: integer("deposit").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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

export type InsertBooking = typeof bookings.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const pickupPoints = sqliteTable("pickup_points", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  city: text("city").notNull(),
  address: text("address").notNull(),
  hours: text("hours").notNull(),
  phone: text("phone").notNull(),
});

export const insertPickupPointSchema = createInsertSchema(pickupPoints).omit({
  id: true,
});

export type InsertPickupPoint = typeof pickupPoints.$inferInsert;
export type PickupPoint = typeof pickupPoints.$inferSelect;

export const ITEM_STATUSES = ["available", "booked", "unavailable"] as const;
export type ItemStatus = typeof ITEM_STATUSES[number];
export const itemStatusSchema = z.enum(ITEM_STATUSES);

export const BOOKING_STATUSES = ["pending", "confirmed", "rejected", "completed", "Cancelled", "Pending", "Paid", "Active", "Completed"] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

const imageDataUrlSchema = z.string().regex(
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/,
  "Некорректный формат сохранённого изображения"
);

const imageUrlSchema = z.string().url("Некорректный URL изображения").refine(
  (value) => value.startsWith("http://") || value.startsWith("https://"),
  "URL изображения должен начинаться с http:// или https://"
);

export const itemImageSchema = z.union([imageDataUrlSchema, imageUrlSchema]);

export const updateItemSchema = z.object({
  brand: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  pricePerDay: z.number().min(1).optional(),
  deposit: z.number().min(0).optional(),
  condition: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  images: z.array(itemImageSchema).optional(),
  isActive: z.boolean().optional(),
  status: z.enum(["available", "booked", "unavailable"]).optional(),
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
  images: z.array(itemImageSchema).default([]),
  isActive: z.boolean().default(true),
  status: z.enum(["available", "booked", "unavailable"]).default("available"),
});

export type BookingWithItem = Booking & { item: Item };
