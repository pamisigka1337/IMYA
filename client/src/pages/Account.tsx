import { Link, useLocation } from "wouter";
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
import { User, Package, Calendar, X } from "lucide-react";
import type { Booking, Item } from "@shared/schema";

type BookingWithItem = Booking & { item: Item };

const statusLabels: Record<string, string> = {
  Pending: "Ожидает оплаты",
  Paid: "Оплачено",
  Active: "Активно",
  Completed: "Завершено",
  Cancelled: "Отменено",
};

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Pending: "secondary",
  Paid: "default",
  Active: "default",
  Completed: "outline",
  Cancelled: "destructive",
};

export default function Account() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingWithItem[]>({
    queryKey: ["/api/bookings/my"],
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: async (bookingId: string) => {
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/my"] });
      toast({
        title: "Бронь отменена",
        description: "Ваша бронь успешно отменена",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
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
          <p className="text-muted-foreground mt-2">Войдите в аккаунт для просмотра личного кабинета</p>
          <Link href="/login">
            <Button className="mt-4 rounded-xl">Войти</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="mx-auto max-w-3xl px-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center ring-1 ring-primary/40">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{user.name}</h1>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </div>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Мои бронирования
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4 p-4 border rounded-md">
                    <Skeleton className="w-16 h-20 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !bookings || bookings.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">У вас пока нет бронирований</p>
                <Link href="/catalog">
                  <Button variant="outline" className="mt-4 rounded-xl">
                    Перейти в каталог
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex gap-4 p-4 border border-border/50 rounded-xl hover-elevate"
                    data-testid={`booking-item-${booking.id}`}
                  >
                    <Link href={`/item/${booking.item.id}`}>
                      <div className="w-16 h-20 rounded-md overflow-hidden bg-secondary shrink-0 cursor-pointer">
                        <img
                          src={booking.item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=200&h=250&fit=crop"}
                          alt={booking.item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{booking.item.brand}</p>
                          <h3 className="font-medium truncate">{booking.item.title}</h3>
                        </div>
                        <Badge variant={statusColors[booking.status]}>
                          {statusLabels[booking.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {format(parseISO(booking.startDate), "d MMM", { locale: ru })} - {format(parseISO(booking.endDate), "d MMM yyyy", { locale: ru })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="font-semibold">
                          {(booking.totalPrice + booking.deposit).toLocaleString("ru-RU")} ₽
                        </span>
                        <div className="flex gap-2">
                          {booking.status === "Pending" && (
                            <>
                              <Link href={`/checkout/${booking.id}`}>
                                <Button size="sm" data-testid={`button-pay-${booking.id}`}>
                                  Оплатить
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelMutation.mutate(booking.id)}
                                disabled={cancelMutation.isPending}
                                data-testid={`button-cancel-${booking.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {booking.status === "Paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelMutation.mutate(booking.id)}
                              disabled={cancelMutation.isPending}
                              data-testid={`button-cancel-${booking.id}`}
                            >
                              Отменить
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
