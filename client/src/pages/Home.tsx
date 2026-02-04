import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ItemCard } from "@/components/ItemCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Sparkles, Clock, Shield, MapPin, Phone } from "lucide-react";
import type { Item, PickupPoint } from "@shared/schema";

function formatPrice(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n) + " ₽";
}

export default function Home() {
  const { data: items, isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const { data: pickupPoints, isLoading: pickupLoading } = useQuery<PickupPoint[]>({
    queryKey: ["/api/pickup-points"],
  });

  return (
    <div className="min-h-screen">
      <section className="relative py-20 md:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              Прокат брендовой<br />
              <span className="text-primary">одежды</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-lg">
              Выглядите роскошно на любом мероприятии. Аренда дизайнерских нарядов по доступным ценам.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/catalog">
                <Button size="lg" className="rounded-xl" data-testid="button-browse-catalog">
                  Смотреть каталог
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/catalog">
                <Button variant="outline" size="lg" className="rounded-xl" data-testid="button-how-it-works">
                  Как это работает
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Как это работает</h2>
          <p className="text-muted-foreground text-center mt-2 max-w-lg mx-auto">
            Всего 3 простых шага до идеального образа
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: Sparkles, title: "1. Выберите наряд", desc: "Просмотрите каталог и найдите идеальный образ для вашего события" },
              { icon: Clock, title: "2. Забронируйте даты", desc: "Выберите удобные даты аренды и оформите бронь онлайн" },
              { icon: Shield, title: "3. Заберите и верните", desc: "Заберите наряд в пункте выдачи и верните после использования" },
            ].map((step, i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-card p-6 text-center">
                <div className="w-14 h-14 bg-primary/20 text-primary rounded-2xl flex items-center justify-center mx-auto">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold mt-4">{step.title}</h3>
                <p className="text-sm text-muted-foreground mt-2">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Популярные товары</h2>
              <p className="text-muted-foreground mt-1">Самые востребованные наряды этого сезона</p>
            </div>
            <Link href="/catalog" className="hidden md:block">
              <Button variant="outline" className="rounded-xl" data-testid="link-view-all">
                Все товары
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {itemsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl border border-border/50 bg-card p-4">
                  <Skeleton className="aspect-[4/3] rounded-xl" />
                  <Skeleton className="h-3 w-16 mt-4" />
                  <Skeleton className="h-5 w-full mt-2" />
                  <Skeleton className="h-4 w-32 mt-2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {items?.slice(0, 4).map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </div>
          )}
          
          <div className="mt-8 text-center md:hidden">
            <Link href="/catalog">
              <Button variant="outline" className="rounded-xl" data-testid="link-view-all-mobile">
                Все товары
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center">Пункт самовывоза</h2>
          <p className="text-muted-foreground text-center mt-2 max-w-lg mx-auto">
            Заберите и верните ваш заказ в удобном месте
          </p>
          
          {pickupLoading ? (
            <div className="max-w-md mx-auto mt-8">
              <div className="rounded-2xl border border-border/50 bg-card p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-4 w-36" />
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto mt-8">
              {pickupPoints?.[0] && (
                <div className="rounded-2xl border border-border/50 bg-card p-6">
                  <h3 className="font-semibold text-lg mb-4">{pickupPoints[0].city}</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>{pickupPoints[0].address}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-primary shrink-0" />
                      <span>{pickupPoints[0].hours}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-primary shrink-0" />
                      <span>{pickupPoints[0].phone}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
