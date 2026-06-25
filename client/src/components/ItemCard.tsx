import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Heart, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Item } from "@shared/schema";
interface ItemCardProps { item: Item; }
const itemStatusLabels: Record<string, string> = { available: "Доступен", booked: "Забронирован", unavailable: "Недоступен" };
const itemStatusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = { available: "default", booked: "secondary", unavailable: "destructive" };
function formatPrice(n: number) { return new Intl.NumberFormat("ru-RU").format(n) + " ₽"; }
export function ItemCard({ item }: ItemCardProps) {
  const { user } = useAuth();
  const imageUrl = item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=400&h=500&fit=crop";
  const fav = useMutation({ mutationFn: async () => apiRequest(item.isFavorite ? "DELETE" : "POST", `/api/favorites/${item.id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/items"] }); queryClient.invalidateQueries({ queryKey: ["/api/favorites"] }); } });
  return <div className="group rounded-2xl border border-border/50 bg-card p-4 hover:border-border transition"><Link href={`/item/${item.id}`}><div className="aspect-[4/3] overflow-hidden rounded-xl border border-border/50"><img src={imageUrl} alt={item.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" /></div></Link><div className="mt-4"><div className="text-xs text-muted-foreground">{item.brand}</div><Link href={`/item/${item.id}`}><h3 className="font-medium mt-0.5 line-clamp-1 hover:text-primary">{item.title}</h3></Link><div className="mt-2 flex items-center justify-between text-sm"><span className="text-muted-foreground">{item.category} • {item.size}</span><span className="text-primary font-semibold">{formatPrice(item.pricePerDay)}/день</span></div><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Star className="h-3.5 w-3.5 fill-primary text-primary" />{item.reviewsCount ? `${item.averageRating?.toFixed(1)} (${item.reviewsCount})` : "Пока нет отзывов"}</div><div className="mt-2 flex gap-2 flex-wrap"><Badge variant={itemStatusVariants[item.status] || "outline"} className="text-xs">{itemStatusLabels[item.status] || item.status}</Badge>{item.condition === "Новое" && <Badge className="bg-green-600 text-white text-xs">Новое</Badge>}</div><div className="mt-3 flex gap-2"><Button type="button" variant={item.isFavorite ? "default" : "outline"} size="sm" className="rounded-xl" disabled={!user || fav.isPending} onClick={() => fav.mutate()}><Heart className={`mr-2 h-4 w-4 ${item.isFavorite ? "fill-current" : ""}`} />{item.isFavorite ? "В избранном" : "В избранное"}</Button><Link href={`/item/${item.id}`}><Button size="sm" variant="ghost">Перейти</Button></Link></div></div></div>;
}
