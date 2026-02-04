import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import type { Item } from "@shared/schema";

interface ItemCardProps {
  item: Item;
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

export function ItemCard({ item }: ItemCardProps) {
  const imageUrl = item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400&h=500&fit=crop";

  return (
    <Link href={`/item/${item.id}`}>
      <div className="group rounded-2xl border border-border/50 bg-card p-4 hover:border-border transition cursor-pointer">
        <div className="aspect-[4/3] overflow-hidden rounded-xl border border-border/50">
          <img
            src={imageUrl}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <div className="mt-4">
          <div className="text-xs text-muted-foreground">{item.brand}</div>
          <h3 className="font-medium mt-0.5 line-clamp-1">{item.title}</h3>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{item.category} • {item.size}</span>
            <span className="text-primary font-semibold">{formatPrice(item.pricePerDay)}/день</span>
          </div>
          {item.condition === "Новое" && (
            <Badge className="mt-2 bg-green-600 text-white text-xs">Новое</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
