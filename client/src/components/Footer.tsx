import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { PickupPoint } from "@shared/schema";

export function Footer() {
  const { data: pickupPoints } = useQuery<PickupPoint[]>({
    queryKey: ["/api/pickup-points"],
  });

  const pickupPoint = pickupPoints?.[0];

  return (
    <footer className="border-t border-border/50 mt-16">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground flex flex-col gap-2">
        <div className="font-medium text-foreground">IMYA — прокат брендовой одежды</div>
        {pickupPoint && (
          <div>Самовывоз: {pickupPoint.city}, {pickupPoint.address} • {pickupPoint.hours}</div>
        )}
        {pickupPoint && (
          <div>Тел.: {pickupPoint.phone}</div>
        )}
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap gap-4">
          <Link href="/" className="hover:text-foreground transition">Главная</Link>
          <Link href="/catalog" className="hover:text-foreground transition">Каталог</Link>
          <Link href="/account" className="hover:text-foreground transition">Кабинет</Link>
        </div>
      </div>
    </footer>
  );
}
