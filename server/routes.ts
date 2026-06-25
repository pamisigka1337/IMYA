import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { storage } from "./storage";
import { registerSchema, loginSchema, createBookingSchema, createItemSchema, updateItemSchema, bookingStatusSchema, itemImageSchema, itemStatusSchema, paymentMethodSchema, createReviewSchema } from "@shared/schema";
import { calculateRentalDays, getRentalDateError } from "@shared/rental";
import { initializeDatabase } from "./db";
import { seed } from "./seed";
import MemoryStore from "memorystore";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const SessionStore = MemoryStore(session);

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const notificationSettingsSchema = z.object({
  bookingConfirmed: z.boolean(),
  refunds: z.boolean(),
  paymentStatus: z.boolean(),
});

const profilePatchSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа").optional(),
  phone: z.string().max(40).nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  preferredPickupPoint: z.string().max(160).nullable().optional(),
  notificationSettings: notificationSettingsSchema.optional(),
});

const passwordPatchSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: z.string().min(6, "Новый пароль должен содержать минимум 6 символов"),
  repeatPassword: z.string().min(1, "Повторите новый пароль"),
}).refine((data) => data.newPassword === data.repeatPassword, { message: "Новый пароль и повтор должны совпадать", path: ["repeatPassword"] });

function publicUser(user: Awaited<ReturnType<typeof storage.getUser>>) {
  if (!user) return undefined;
  return { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, city: user.city, preferredPickupPoint: user.preferredPickupPoint, notificationSettings: user.notificationSettings };
}

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function detectImageContentType(data: Buffer) {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    data.length > 12 &&
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

function imageToDataUrl(image: UploadedImage) {
  const detectedContentType = detectImageContentType(image.data);
  if (!ALLOWED_IMAGE_TYPES.has(image.contentType) || !detectedContentType || detectedContentType !== image.contentType) {
    throw new Error("Можно загружать только PNG, JPG, JPEG или WEBP");
  }
  if (image.data.length > MAX_UPLOAD_SIZE) {
    throw new Error("Размер изображения не должен превышать 10 МБ");
  }
  return itemImageSchema.parse(`data:${detectedContentType};base64,${image.data.toString("base64")}`);
}

type UploadedImage = { filename: string; contentType: string; data: Buffer };

async function readMultipartImages(req: Request): Promise<UploadedImage[]> {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:(?:"([^"]+)")|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Некорректная форма загрузки");
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_UPLOAD_SIZE * 10) throw new Error("Слишком большой запрос");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks).toString("binary");
  return body.split(`--${boundary}`).flatMap((part): UploadedImage[] => {
    if (!part.includes('Content-Disposition') || !part.includes('filename=')) return [];
    const [rawHeaders, rawContent = ""] = part.split("\r\n\r\n");
    const filename = rawHeaders.match(/filename="([^"]+)"/)?.[1] || "";
    const contentType = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || "";
    const content = rawContent.replace(/\r\n$/, "");
    if (!filename || !content) return [];
    return [{ filename, contentType, data: Buffer.from(content, "binary") }];
  });
}


function getSingleParam(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Требуется авторизация" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).json({ message: "Доступ запрещён" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "rental-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({ checkPeriod: 86400000 }),
      cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Create local SQLite tables and seed test data automatically.
  initializeDatabase();
  await seed();

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ message: "Пользователь с таким email уже существует" });
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      const user = await storage.createUser({
        name: data.name,
        email: data.email,
        passwordHash,
        role: "user",
      });

      req.session.userId = user.id;
      res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка регистрации" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(400).json({ message: "Неверный email или пароль" });
      }

      const valid = await bcrypt.compare(data.password, user.passwordHash);
      if (!valid) {
        return res.status(400).json({ message: "Неверный email или пароль" });
      }

      req.session.userId = user.id;
      res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка входа" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Не авторизован" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Пользователь не найден" });
    }

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });


  app.get("/api/profile", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(404).json({ message: "Пользователь не найден" });
    await storage.completeDueRefunds(req.session.userId!);
    const bookings = await storage.getBookingsByUser(req.session.userId!);
    const stats = await storage.getProfileStats(req.session.userId!);
    const paymentHistory = bookings
      .filter((booking) => booking.paidAt)
      .map((booking) => ({
        id: booking.id,
        paidAt: booking.paidAt,
        amount: booking.totalPrice + booking.deposit,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        refundStatus: booking.refundStatus,
        itemTitle: booking.item.title,
      }));
    res.json({ user: publicUser(user), stats, paymentHistory });
  });

  app.patch("/api/profile", requireAuth, async (req, res) => {
    try {
      const data = profilePatchSchema.parse(req.body);
      const user = await storage.updateUserProfile(req.session.userId!, data);
      res.json({ user: publicUser(user) });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Не удалось сохранить профиль" });
    }
  });

  app.patch("/api/profile/password", requireAuth, async (req, res) => {
    try {
      const data = passwordPatchSchema.parse(req.body);
      const user = await storage.getUser(req.session.userId!);
      if (!user) return res.status(404).json({ message: "Пользователь не найден" });
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!valid) return res.status(400).json({ message: "Текущий пароль указан неверно" });
      await storage.updateUserPassword(user.id, await bcrypt.hash(data.newPassword, 10));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Не удалось изменить пароль" });
    }
  });

  // Items routes
  app.get("/api/items", async (req, res) => {
    const { search = "", category = "", minPrice = "", maxPrice = "" } = req.query;
    const q = String(search).toLowerCase().trim();
    const min = minPrice ? Number(minPrice) : undefined;
    const max = maxPrice ? Number(maxPrice) : undefined;
    const allItems = await storage.getItems();
    const favoriteIds = req.session.userId ? new Set((await storage.getFavorites(req.session.userId)).map((item) => item.id)) : new Set<string>();
    res.json(allItems.map((item) => ({ ...item, isFavorite: favoriteIds.has(item.id) })).filter((item) => {
      if (!item.isActive) return false;
      if (q && !item.title.toLowerCase().includes(q)) return false;
      if (category && String(category) !== "all" && item.category !== String(category)) return false;
      if (Number.isFinite(min) && item.pricePerDay < min!) return false;
      if (Number.isFinite(max) && item.pricePerDay > max!) return false;
      return true;
    }));
  });

  app.get("/api/items/:id", async (req, res) => {
    const item = await storage.getItem(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Товар не найден" });
    }
    if (req.session.userId) {
      const favoriteIds = new Set((await storage.getFavorites(req.session.userId)).map((favorite) => favorite.id));
      return res.json({ ...item, isFavorite: favoriteIds.has(item.id) });
    }
    res.json(item);
  });

  app.get("/api/items/:id/bookings", async (req, res) => {
    const bookings = await storage.getBookingsByItem(req.params.id);
    res.json(bookings);
  });

  app.get("/api/items/:id/availability", async (req, res) => {
    res.json(await storage.getAvailability(req.params.id));
  });

  app.get("/api/items/:id/reviews", async (req, res) => {
    res.json(await storage.getReviewsByItem(req.params.id));
  });

  app.get("/api/items/:id/can-review", async (req, res) => {
    if (!req.session.userId) {
      return res.json({ canReview: false, reason: "Необходимо войти в аккаунт" });
    }
    const itemId = getSingleParam(req.params.id);
    res.json(await storage.getReviewEligibility(req.session.userId, itemId));
  });

  app.post("/api/items/:id/reviews", requireAuth, async (req, res) => {
    try {
      const data = createReviewSchema.parse(req.body);
      const itemId = getSingleParam(req.params.id);
      if (!(await storage.canReview(req.session.userId!, itemId, data.bookingId))) return res.status(403).json({ message: "Отзыв можно оставить только после оплаченного, подтверждённого или завершённого бронирования" });
      const review = await storage.createReview(req.session.userId!, itemId, data.bookingId, data.rating, data.text);
      res.json(review);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Не удалось сохранить отзыв" });
    }
  });

  app.get("/api/favorites", requireAuth, async (req, res) => {
    res.json(await storage.getFavorites(req.session.userId!));
  });

  app.post("/api/favorites/:itemId", requireAuth, async (req, res) => {
    await storage.addFavorite(req.session.userId!, getSingleParam(req.params.itemId));
    res.json({ success: true });
  });

  app.delete("/api/favorites/:itemId", requireAuth, async (req, res) => {
    await storage.removeFavorite(req.session.userId!, getSingleParam(req.params.itemId));
    res.json({ success: true });
  });

  app.get("/api/receipts/:bookingId", requireAuth, async (req, res) => {
    const booking = await storage.getReceiptBooking(getSingleParam(req.params.bookingId));
    if (!booking) return res.status(404).json({ message: "Бронь не найдена" });
    const viewer = await storage.getUser(req.session.userId!);
    if (booking.userId !== req.session.userId && viewer?.role !== "admin") return res.status(403).json({ message: "Доступ запрещён" });
    if (booking.paymentStatus !== "paid") return res.status(400).json({ message: "Квитанция доступна только после оплаты." });
    res.json(booking);
  });

  // Pickup points
  app.get("/api/pickup-points", async (req, res) => {
    const points = await storage.getPickupPoints();
    res.json(points);
  });

  // Bookings routes
  app.post("/api/bookings", requireAuth, async (req, res) => {
    try {
      const data = createBookingSchema.parse(req.body);
      const userId = req.session.userId!;

      const item = await storage.getItem(data.itemId);
      if (!item || !item.isActive) {
        return res.status(404).json({ message: "Товар не найден" });
      }
      if (item.status !== "available") {
        return res.status(400).json({ message: "Товар сейчас нельзя забронировать" });
      }

      const dateError = getRentalDateError(data.startDate, data.endDate);
      if (dateError) {
        return res.status(400).json({ message: dateError });
      }
      const days = calculateRentalDays(data.startDate, data.endDate);

      const available = await storage.checkAvailability(data.itemId, data.startDate, data.endDate);
      if (!available) {
        return res.status(400).json({ message: "Товар уже занят на выбранные даты" });
      }
      const totalPrice = days * item.pricePerDay;

      const booking = await storage.createBooking({
        userId,
        itemId: data.itemId,
        startDate: data.startDate,
        endDate: data.endDate,
        days,
        totalPrice,
        deposit: item.deposit,
        status: "pending",
        paymentStatus: "pending",
        paymentMethod: null,
      });

      res.json(booking);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка бронирования" });
    }
  });

  app.get("/api/bookings/my", requireAuth, async (req, res) => {
    const bookings = await storage.getBookingsByUser(req.session.userId!);
    res.json(bookings);
  });

  app.get("/api/bookings/:id", requireAuth, async (req, res) => {
    const bookingId = getSingleParam(req.params.id);
    const booking = await storage.getBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Бронь не найдена" });
    }
    if (booking.userId !== req.session.userId) {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Доступ запрещён" });
      }
    }
    res.json(booking);
  });

  app.get("/api/bookings/:id/payment", requireAuth, async (req, res) => {
    const bookingId = getSingleParam(req.params.id);
    const booking = await storage.getBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Бронь не найдена" });
    }
    if (booking.userId !== req.session.userId) {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Доступ запрещён" });
      }
    }
    res.json(booking);
  });

  app.post("/api/bookings/:id/pay", requireAuth, async (req, res) => {
    try {
      const bookingId = getSingleParam(req.params.id);
      const paymentMethod = paymentMethodSchema.parse(req.body?.paymentMethod);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Бронь не найдена" });
      }
      if (booking.userId !== req.session.userId) {
        return res.status(403).json({ message: "Доступ запрещён" });
      }
      if (booking.paymentStatus === "paid") {
        return res.status(400).json({ message: "Бронь уже оплачена" });
      }
      if (!["pending", "Pending"].includes(booking.status)) {
        return res.status(400).json({ message: "Нельзя оплатить бронь с текущим статусом" });
      }

      const updated = await storage.markBookingPaid(bookingId, paymentMethod);
      await storage.updateItemStatus(booking.itemId, "booked");
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Некорректный способ оплаты" });
    }
  });

  app.post("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
    const bookingId = getSingleParam(req.params.id);
    const booking = await storage.getBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Бронь не найдена" });
    }
    if (booking.userId !== req.session.userId) {
      const user = await storage.getUser(req.session.userId!);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Доступ запрещён" });
      }
    }
    if (booking.status === "completed" || booking.status === "Completed") {
      return res.status(400).json({ message: "Нельзя отменить завершённую аренду" });
    }

    const updated = await storage.cancelBooking(bookingId, booking.paymentStatus === "paid");
    if (!(await storage.hasActiveConfirmedBooking(booking.itemId))) {
      await storage.updateItemStatus(booking.itemId, "available");
    }
    res.json(updated);
  });

  // Admin routes
  app.get("/api/admin/items", requireAdmin, async (req, res) => {
    const items = await storage.getItems();
    res.json(items);
  });


  app.post("/api/admin/uploads", requireAdmin, async (req, res) => {
    try {
      const uploadedImages = await readMultipartImages(req);
      if (uploadedImages.length === 0) {
        return res.status(400).json({ message: "Выберите хотя бы одно изображение" });
      }

      const urls = uploadedImages.map(imageToDataUrl);

      res.json({ urls });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка загрузки изображений" });
    }
  });


  app.post("/api/admin/items/:id/images", requireAdmin, async (req, res) => {
    try {
      const itemId = getSingleParam(req.params.id);
      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Товар не найден" });
      }

      const uploadedImages = await readMultipartImages(req);
      if (uploadedImages.length === 0) {
        return res.status(400).json({ message: "Выберите хотя бы одно изображение" });
      }

      const urls = uploadedImages.map(imageToDataUrl);
      const updated = await storage.updateItem(itemId, { images: [...item.images, ...urls] });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка сохранения изображений" });
    }
  });

  app.post("/api/admin/items", requireAdmin, async (req, res) => {
    try {
      const data = createItemSchema.parse(req.body);
      const item = await storage.createItem(data);
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка создания товара" });
    }
  });

  app.patch("/api/admin/items/:id", requireAdmin, async (req, res) => {
    try {
      const data = updateItemSchema.parse(req.body);
      const itemId = getSingleParam(req.params.id);
      const item = await storage.updateItem(itemId, data);
      if (!item) {
        return res.status(404).json({ message: "Товар не найден" });
      }
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка обновления" });
    }
  });


  app.patch("/api/items/:id/status", requireAdmin, async (req, res) => {
    try {
      const status = itemStatusSchema.parse(req.body.status);
      const item = await storage.updateItemStatus(getSingleParam(req.params.id), status);
      if (!item) return res.status(404).json({ message: "Товар не найден" });
      res.json(item);
    } catch (error: any) {
      res.status(400).json({ message: "Некорректный статус товара" });
    }
  });

  app.delete("/api/admin/items/:id", requireAdmin, async (req, res) => {
    try {
      const itemId = getSingleParam(req.params.id);
      const item = await storage.getItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Товар не найден" });
      }

      const itemBookings = await storage.getBookingsByItem(itemId);
      if (itemBookings.length > 0) {
        return res.status(409).json({
          message: "Нельзя удалить товар, у которого есть бронирования. Сначала отмените или завершите связанные бронирования.",
        });
      }

      await storage.deleteItem(itemId);
      res.json({ success: true, message: "Товар удалён", id: itemId });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Ошибка удаления товара" });
    }
  });

  app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
    const bookings = await storage.getBookings();
    res.json(bookings);
  });

  app.get("/api/admin/stats", requireAdmin, async (_req, res) => {
    res.json(await storage.getAdminStats());
  });

  app.get("/api/admin/reviews", requireAdmin, async (_req, res) => {
    res.json(await storage.getAllReviews());
  });

  app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    await storage.deleteReview(getSingleParam(req.params.id));
    res.json({ success: true });
  });

  app.patch("/api/admin/bookings/:id/status", requireAdmin, async (req, res) => {
    try {
      const bookingId = getSingleParam(req.params.id);
      const { status } = req.body;
      const validatedStatus = bookingStatusSchema.parse(status);
      const booking = await storage.updateBookingStatus(bookingId, validatedStatus);
      if (!booking) {
        return res.status(404).json({ message: "Бронь не найдена" });
      }
      if (validatedStatus === "confirmed") {
        await storage.updateItemStatus(booking.itemId, "booked");
      }
      if (validatedStatus === "rejected" || validatedStatus === "completed") {
        if (!(await storage.hasActiveConfirmedBooking(booking.itemId))) {
          await storage.updateItemStatus(booking.itemId, "available");
        }
      }
      res.json(booking);
    } catch (error: any) {
      res.status(400).json({ message: "Некорректный статус" });
    }
  });

  return httpServer;
}
