import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Item } from "@shared/schema";

interface ItemCardProps {
  item: Item;
}

export function ItemCard({ item }: ItemCardProps) {
  const imageUrl = item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400&h=500&fit=crop";

  return (
    <Link href={`/item/${item.id}`}>
      <Card className="group overflow-hidden hover-elevate cursor-pointer border-0 bg-transparent">
        <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-secondary">
          <img
            src={imageUrl}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-3 left-3 flex flex-col gap-1">
            <Badge variant="secondary" className="bg-background/90 backdrop-blur text-xs">
              {item.brand}
            </Badge>
          </div>
          {item.condition === "Новое" && (
            <Badge className="absolute top-3 right-3 bg-green-600 text-white text-xs">
              Новое
            </Badge>
          )}
        </div>
        <CardContent className="px-1 pt-3 pb-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.category}</p>
          <h3 className="font-medium text-sm mt-1 line-clamp-2">{item.title}</h3>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-semibold">{item.pricePerDay.toLocaleString("ru-RU")} ₽</span>
            <span className="text-xs text-muted-foreground">/ день</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Размер: {item.size} • Залог: {item.deposit.toLocaleString("ru-RU")} ₽
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
