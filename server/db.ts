import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "@shared/schema";

export const databasePath = resolve(process.cwd(), "data", "app.db");
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new DatabaseSync(databasePath);
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec("PRAGMA journal_mode = WAL");

async function runQuery(sql: string, params: unknown[], method: "run" | "all" | "values" | "get") {
  const statement = sqlite.prepare(sql);
  statement.setReturnArrays(true);

  if (method === "run") {
    statement.run(...params);
    return { rows: [] };
  }

  if (method === "get") {
    const row = statement.get(...params) as unknown[] | undefined;
    return { rows: row ?? [] };
  }

  return { rows: statement.all(...params) as unknown[][] };
}

export const db = drizzle(runQuery, { schema });

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY NOT NULL,
      brand TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      size TEXT NOT NULL,
      price_per_day INTEGER NOT NULL,
      deposit INTEGER NOT NULL,
      images TEXT NOT NULL DEFAULT '[]',
      condition TEXT NOT NULL,
      description TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'available'
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      item_id TEXT NOT NULL REFERENCES items(id),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      deposit INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pickup_points (
      id TEXT PRIMARY KEY NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      hours TEXT NOT NULL,
      phone TEXT NOT NULL
    );
  `);

  const bookingColumnsStatement = sqlite.prepare("PRAGMA table_info(bookings)");
  bookingColumnsStatement.setReturnArrays(true);
  const bookingColumns = bookingColumnsStatement.all() as unknown[][];
  if (!bookingColumns.some((column) => column[1] === "payment_status")) {
    sqlite.exec("ALTER TABLE bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending'");
  }
  if (!bookingColumns.some((column) => column[1] === "payment_method")) {
    sqlite.exec("ALTER TABLE bookings ADD COLUMN payment_method TEXT");
  }
  if (!bookingColumns.some((column) => column[1] === "paid_at")) {
    sqlite.exec("ALTER TABLE bookings ADD COLUMN paid_at TEXT");
  }

  const itemColumnsStatement = sqlite.prepare("PRAGMA table_info(items)");
  itemColumnsStatement.setReturnArrays(true);
  const itemColumns = itemColumnsStatement.all() as unknown[][];
  if (!itemColumns.some((column) => column[1] === "status")) {
    sqlite.exec("ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'available'");
  }

  sqlite.exec("UPDATE items SET status = 'unavailable' WHERE is_active = 0 AND status = 'available'");
}
