import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, items, pickupPoints } from "@shared/schema";
import { eq } from "drizzle-orm";

const SEED_ITEMS = [
  {
    brand: "Gucci",
    title: "Вечернее платье с пайетками",
    category: "Платья",
    size: "S",
    pricePerDay: 5500,
    deposit: 25000,
    images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&h=1000&fit=crop"],
    condition: "Отличное",
    description: "Роскошное вечернее платье от Gucci, расшитое пайетками. Идеально для торжественных мероприятий. Элегантный силуэт подчеркивает фигуру.",
    isActive: true,
  },
  {
    brand: "Prada",
    title: "Шёлковое коктейльное платье",
    category: "Платья",
    size: "M",
    pricePerDay: 4200,
    deposit: 20000,
    images: ["https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&h=1000&fit=crop"],
    condition: "Новое",
    description: "Изысканное коктейльное платье из натурального шёлка. Нежный цвет и струящаяся ткань создают невероятно женственный образ.",
    isActive: true,
  },
  {
    brand: "Dior",
    title: "Классический мужской костюм",
    category: "Костюмы",
    size: "L",
    pricePerDay: 6000,
    deposit: 30000,
    images: ["https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&h=1000&fit=crop"],
    condition: "Отличное",
    description: "Безупречный мужской костюм от Dior. Идеальный крой, премиальная шерстяная ткань. Для важных деловых встреч и торжественных мероприятий.",
    isActive: true,
  },
  {
    brand: "Chanel",
    title: "Твидовый костюм",
    category: "Костюмы",
    size: "S",
    pricePerDay: 7500,
    deposit: 35000,
    images: ["https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=800&h=1000&fit=crop"],
    condition: "Новое",
    description: "Культовый твидовый костюм Chanel — воплощение французской элегантности. Жакет с фирменной отделкой и юбка-карандаш.",
    isActive: true,
  },
  {
    brand: "Valentino",
    title: "Кашемировое пальто",
    category: "Верхняя одежда",
    size: "M",
    pricePerDay: 5000,
    deposit: 40000,
    images: ["https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&h=1000&fit=crop"],
    condition: "Отличное",
    description: "Элегантное кашемировое пальто Valentino. Классический силуэт, мягкая ткань высшего качества. Универсальный цвет подходит к любому образу.",
    isActive: true,
  },
  {
    brand: "Balenciaga",
    title: "Тренч оверсайз",
    category: "Верхняя одежда",
    size: "L",
    pricePerDay: 4500,
    deposit: 28000,
    images: ["https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800&h=1000&fit=crop"],
    condition: "Хорошее",
    description: "Модный тренч в стиле оверсайз от Balenciaga. Современный дизайн, качественная ткань с водоотталкивающей пропиткой.",
    isActive: true,
  },
  {
    brand: "Gucci",
    title: "Кожаная сумка Dionysus",
    category: "Аксессуары",
    size: "M",
    pricePerDay: 2500,
    deposit: 50000,
    images: ["https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&h=1000&fit=crop"],
    condition: "Отличное",
    description: "Культовая сумка Gucci Dionysus из натуральной кожи. Узнаваемый дизайн с фирменной застёжкой. Идеальный аксессуар для особых случаев.",
    isActive: true,
  },
  {
    brand: "Dior",
    title: "Клатч Lady Dior",
    category: "Аксессуары",
    size: "S",
    pricePerDay: 1800,
    deposit: 35000,
    images: ["https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&h=1000&fit=crop"],
    condition: "Новое",
    description: "Элегантный клатч Lady Dior с фирменным стёганым узором. Компактный размер, вместительное внутреннее отделение.",
    isActive: true,
  },
  {
    brand: "Prada",
    title: "Макси-платье в пол",
    category: "Платья",
    size: "L",
    pricePerDay: 4800,
    deposit: 22000,
    images: ["https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&h=1000&fit=crop"],
    condition: "Отличное",
    description: "Роскошное макси-платье от Prada для особых случаев. Струящийся силуэт, элегантный дизайн. Подходит для свадьбы или гала-вечера.",
    isActive: true,
  },
  {
    brand: "Chanel",
    title: "Маленькое чёрное платье",
    category: "Платья",
    size: "XS",
    pricePerDay: 5200,
    deposit: 25000,
    images: ["https://images.unsplash.com/photo-1550639525-c97d455acf70?w=800&h=1000&fit=crop"],
    condition: "Отличное",
    description: "Классическое маленькое чёрное платье от Chanel. Вневременной дизайн, безупречный крой. Must-have для любого гардероба.",
    isActive: true,
  },
  {
    brand: "Valentino",
    title: "Смокинг для торжеств",
    category: "Костюмы",
    size: "XL",
    pricePerDay: 6500,
    deposit: 32000,
    images: ["https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&h=1000&fit=crop"],
    condition: "Новое",
    description: "Элегантный смокинг Valentino для особых мероприятий. Атласные лацканы, идеальная посадка. Классика, которая никогда не выходит из моды.",
    isActive: true,
  },
  {
    brand: "Balenciaga",
    title: "Шарф-палантин кашемир",
    category: "Аксессуары",
    size: "M",
    pricePerDay: 800,
    deposit: 8000,
    images: ["https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=800&h=1000&fit=crop"],
    condition: "Хорошее",
    description: "Мягкий кашемировый шарф-палантин от Balenciaga. Универсальный аксессуар, который дополнит любой образ и согреет в прохладную погоду.",
    isActive: true,
  },
];

const SEED_PICKUP_POINT = {
  city: "Москва",
  address: "ул. Тверская, д. 12, этаж 2, офис 205",
  hours: "Пн-Вс: 10:00 - 21:00",
  phone: "+7 (495) 123-45-67",
};

export async function seed() {
  console.log("Seeding database...");

  // Check if already seeded
  const existingItems = await db.select().from(items).limit(1);
  if (existingItems.length > 0) {
    console.log("Database already seeded, skipping...");
    return;
  }

  // Create admin user
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  await db.insert(users).values({
    name: "Администратор",
    email: "admin@prokat.ru",
    passwordHash: adminPasswordHash,
    role: "admin",
  });
  console.log("Admin user created: admin@prokat.ru / admin123");

  // Create test user
  const userPasswordHash = await bcrypt.hash("user123", 10);
  await db.insert(users).values({
    name: "Тестовый Пользователь",
    email: "user@test.ru",
    passwordHash: userPasswordHash,
    role: "user",
  });
  console.log("Test user created: user@test.ru / user123");

  // Create items
  for (const item of SEED_ITEMS) {
    await db.insert(items).values(item);
  }
  console.log(`Created ${SEED_ITEMS.length} items`);

  // Create pickup point
  await db.insert(pickupPoints).values(SEED_PICKUP_POINT);
  console.log("Pickup point created");

  console.log("Seeding complete!");
}
