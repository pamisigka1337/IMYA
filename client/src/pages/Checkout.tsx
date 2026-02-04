import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, MapPin, Clock, Phone, CheckCircle, CreditCard } from "lucide-react";
import type { Booking, Item, PickupPoint } from "@shared/schema";

type BookingWithItem = Booking & { item: Item };

export default function Checkout() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: booking, isLoading: bookingLoading } = useQuery<BookingWithItem>({
    queryKey: ["/api/bookings", bookingId],
    enabled: !!bookingId && !!user,
  });

  const { data: pickupPoints } = useQuery<PickupPoint[]>({
    queryKey: ["/api/pickup-points"],
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/pay`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", bookingId] });
      toast({
        title: "Оплата успешна",
        description: "Ваша бронь оплачена. Ждём вас в пункте выдачи!",
      });
      setLocation("/account");
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка оплаты",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Требуется авторизация</h1>
          <p className="text-muted-foreground mt-2">Войдите в аккаунт для оформления заказа</p>
          <Link href="/login">
            <Button className="mt-4">Войти</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (bookingLoading) {
    return (
      <div className="min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Skeleton className="h-8 w-48 mb-8" />
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Бронь не найдена</h1>
          <Link href="/catalog">
            <Button variant="outline" className="mt-4">
              Вернуться в каталог
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const startDate = parseISO(booking.startDate);
  const endDate = parseISO(booking.endDate);
  const pickupPoint = pickupPoints?.[0];
  const isPaid = booking.status === "Paid" || booking.status === "Active" || booking.status === "Completed";

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link href="/catalog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Назад в каталог
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold mb-8">
          {isPaid ? "Бронь оплачена" : "Оформление заказа"}
        </h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between gap-2">
                <span>Детали бронирования</span>
                <Badge variant={isPaid ? "default" : "secondary"}>
                  {booking.status === "Pending" && "Ожидает оплаты"}
                  {booking.status === "Paid" && "Оплачено"}
                  {booking.status === "Active" && "Активно"}
                  {booking.status === "Completed" && "Завершено"}
                  {booking.status === "Cancelled" && "Отменено"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="w-20 h-24 rounded-md overflow-hidden bg-secondary shrink-0">
                  <img
                    src={booking.item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=200&h=250&fit=crop"}
                    alt={booking.item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{booking.item.brand}</p>
                  <h3 className="font-semibold">{booking.item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Размер: {booking.item.size}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Дата начала</span>
                  <span>{format(startDate, "d MMMM yyyy", { locale: ru })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Дата окончания</span>
                  <span>{format(endDate, "d MMMM yyyy", { locale: ru })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Количество дней</span>
                  <span>{booking.days}</span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Аренда ({booking.days} {booking.days === 1 ? "день" : booking.days < 5 ? "дня" : "дней"} × {booking.item.pricePerDay.toLocaleString("ru-RU")} ₽)
                  </span>
                  <span>{booking.totalPrice.toLocaleString("ru-RU")} ₽</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Залог (возвращается)</span>
                  <span>{booking.deposit.toLocaleString("ru-RU")} ₽</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>Итого к оплате</span>
                  <span>{(booking.totalPrice + booking.deposit).toLocaleString("ru-RU")} ₽</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {pickupPoint && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Пункт самовывоза</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{pickupPoint.city}</p>
                    <p className="text-sm text-muted-foreground">{pickupPoint.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-sm">{pickupPoint.hours}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="text-sm">{pickupPoint.phone}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {!isPaid && booking.status === "Pending" && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending}
              data-testid="button-pay"
            >
              {payMutation.isPending ? (
                "Обработка..."
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Оплатить {(booking.totalPrice + booking.deposit).toLocaleString("ru-RU")} ₽
                </>
              )}
            </Button>
          )}

          {isPaid && (
            <div className="flex items-center justify-center gap-2 py-4 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Оплата прошла успешно</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
