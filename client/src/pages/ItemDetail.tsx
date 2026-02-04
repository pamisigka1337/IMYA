import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, differenceInDays, parseISO, addDays, isBefore, isAfter } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, CalendarIcon, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import type { Item, Booking } from "@shared/schema";

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  const { data: item, isLoading: itemLoading } = useQuery<Item>({
    queryKey: ["/api/items", id],
    enabled: !!id,
  });

  const { data: bookings } = useQuery<Booking[]>({
    queryKey: ["/api/items", id, "bookings"],
    enabled: !!id,
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data: { itemId: string; startDate: string; endDate: string }) => {
      const res = await apiRequest("POST", "/api/bookings", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", id, "bookings"] });
      setLocation(`/checkout/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disabledDays = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isBefore(date, today)) return true;
    
    if (!bookings) return false;
    
    return bookings
      .filter((b) => b.status !== "Cancelled")
      .some((booking) => {
        const bookingStart = parseISO(booking.startDate);
        const bookingEnd = parseISO(booking.endDate);
        return !isBefore(date, bookingStart) && !isAfter(date, bookingEnd);
      });
  };

  const handleBook = () => {
    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите в аккаунт, чтобы забронировать товар",
      });
      setLocation("/login");
      return;
    }
    
    if (!startDate || !endDate) {
      toast({
        title: "Выберите даты",
        description: "Укажите даты начала и окончания аренды",
        variant: "destructive",
      });
      return;
    }
    
    createBookingMutation.mutate({
      itemId: id!,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    });
  };

  const days = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0;
  const totalPrice = item ? days * item.pricePerDay : 0;
  const totalWithDeposit = item ? totalPrice + item.deposit : 0;

  if (itemLoading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="aspect-[3/4] rounded-md" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Товар не найден</h1>
          <Link href="/catalog">
            <Button variant="outline" className="mt-4 rounded-xl">
              Вернуться в каталог
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const imageUrl = item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=800&h=1000&fit=crop";

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="mx-auto max-w-6xl px-6">
        <Link href="/catalog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад в каталог
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-border/50 bg-card">
            <img
              src={imageUrl}
              alt={item.title}
              className="w-full h-full object-cover"
            />
            {item.condition === "Новое" && (
              <Badge className="absolute top-4 right-4 bg-green-600 text-white">
                Новое
              </Badge>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <Badge variant="secondary" className="mb-3 rounded-lg">{item.brand}</Badge>
              <h1 className="text-2xl md:text-3xl font-bold">{item.title}</h1>
              <p className="text-muted-foreground mt-2">{item.category} • Размер {item.size}</p>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">{item.pricePerDay.toLocaleString("ru-RU")} ₽</span>
              <span className="text-muted-foreground">/ день</span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                <span>Залог: {item.deposit.toLocaleString("ru-RU")} ₽</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Состояние: {item.condition}</span>
              </div>
            </div>

            <p className="text-muted-foreground">{item.description}</p>

            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Выберите даты аренды</h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start flex-1 rounded-xl" data-testid="button-start-date">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "d MMMM", { locale: ru }) : "Дата начала"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date);
                          if (date && endDate && isBefore(endDate, date)) {
                            setEndDate(addDays(date, 1));
                          }
                        }}
                        disabled={disabledDays}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start flex-1 rounded-xl" data-testid="button-end-date">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "d MMMM", { locale: ru }) : "Дата окончания"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => disabledDays(date) || (startDate ? isBefore(date, startDate) : false)}
                        locale={ru}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {days > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Аренда ({days} {days === 1 ? "день" : days < 5 ? "дня" : "дней"})</span>
                      <span>{totalPrice.toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Залог (возвращается)</span>
                      <span>{item.deposit.toLocaleString("ru-RU")} ₽</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t">
                      <span>Итого к оплате</span>
                      <span>{totalWithDeposit.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full rounded-xl"
                  size="lg"
                  onClick={handleBook}
                  disabled={!startDate || !endDate || createBookingMutation.isPending}
                  data-testid="button-book"
                >
                  {createBookingMutation.isPending ? "Оформление..." : "Забронировать"}
                </Button>

                {!user && (
                  <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Для бронирования необходимо войти в аккаунт
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
