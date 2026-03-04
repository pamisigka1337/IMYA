import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcryptjs";
import { differenceInDays, parseISO } from "date-fns";
import { storage } from "./storage";
import { registerSchema, loginSchema, createBookingSchema, createItemSchema, updateItemSchema, bookingStatusSchema } from "@shared/schema";
import { seed } from "./seed";
import MemoryStore from "memorystore";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const SessionStore = MemoryStore(session);

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

  // Seed database
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

  // Items routes
  app.get("/api/items", async (req, res) => {
    const items = await storage.getItems();
    res.json(items.filter(item => item.isActive));
  });

  app.get("/api/items/:id", async (req, res) => {
    const item = await storage.getItem(req.params.id);
    if (!item) {
      return res.status(404).json({ message: "Товар не найден" });
    }
    res.json(item);
  });

  app.get("/api/items/:id/bookings", async (req, res) => {
    const bookings = await storage.getBookingsByItem(req.params.id);
    res.json(bookings);
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

      const available = await storage.checkAvailability(data.itemId, data.startDate, data.endDate);
      if (!available) {
        return res.status(400).json({ message: "Товар недоступен в выбранные даты" });
      }

      const startDate = parseISO(data.startDate);
      const endDate = parseISO(data.endDate);
      const days = differenceInDays(endDate, startDate) + 1;
      const totalPrice = days * item.pricePerDay;

      const booking = await storage.createBooking({
        userId,
        itemId: data.itemId,
        startDate: data.startDate,
        endDate: data.endDate,
        days,
        totalPrice,
        deposit: item.deposit,
        status: "Pending",
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

  app.post("/api/bookings/:id/pay", requireAuth, async (req, res) => {
    const bookingId = getSingleParam(req.params.id);
    const booking = await storage.getBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Бронь не найдена" });
    }
    if (booking.userId !== req.session.userId) {
      return res.status(403).json({ message: "Доступ запрещён" });
    }
    if (booking.status !== "Pending") {
      return res.status(400).json({ message: "Бронь уже оплачена или отменена" });
    }

    const updated = await storage.updateBookingStatus(bookingId, "Paid");
    res.json(updated);
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
    if (booking.status === "Active") {
      return res.status(400).json({ message: "Нельзя отменить активную аренду" });
    }

    const updated = await storage.updateBookingStatus(bookingId, "Cancelled");
    res.json(updated);
  });

  // Admin routes
  app.get("/api/admin/items", requireAdmin, async (req, res) => {
    const items = await storage.getItems();
    res.json(items);
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

  app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
    const bookings = await storage.getBookings();
    res.json(bookings);
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
      res.json(booking);
    } catch (error: any) {
      res.status(400).json({ message: "Некорректный статус" });
    }
  });

  return httpServer;
}
