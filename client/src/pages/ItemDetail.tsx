import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, parseISO, isBefore, isAfter } from "date-fns";
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
import { ArrowLeft, CalendarIcon, Shield, CheckCircle, AlertCircle, Heart, Star } from "lucide-react";
import { Link } from "wouter";
import type { Item, Booking, ReviewWithUser, BookingWithItem } from "@shared/schema";
import { calculateRentalDays, formatRussianDays, getRentalDateError } from "@shared/rental";

const itemStatusLabels: Record<string, string> = { available: "Доступен", booked: "Забронирован", unavailable: "Недоступен" };

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
    queryKey: ["/api/items", id, "availability"],
    enabled: !!id,
  });

  const { data: reviews } = useQuery<ReviewWithUser[]>({ queryKey: ["/api/items", id, "reviews"], enabled: !!id });
  const { data: myBookings } = useQuery<BookingWithItem[]>({ queryKey: ["/api/bookings/my"], enabled: !!user });
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);

  const favoriteMutation = useMutation({ mutationFn: async () => apiRequest(item?.isFavorite ? "DELETE" : "POST", `/api/favorites/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/items", id] }); queryClient.invalidateQueries({ queryKey: ["/api/items"] }); queryClient.invalidateQueries({ queryKey: ["/api/favorites"] }); } });
  const reviewMutation = useMutation({ mutationFn: async () => { const booking = myBookings?.find((b) => b.itemId === id && (b.paymentStatus === "paid" || ["completed", "Completed", "Paid"].includes(b.status))); if (!booking) throw new Error("Нет оплаченного или завершённого бронирования для отзыва"); return (await apiRequest("POST", `/api/items/${id}/reviews`, { bookingId: booking.id, rating, text: reviewText })).json(); }, onSuccess: () => { setReviewText(""); queryClient.invalidateQueries({ queryKey: ["/api/items", id, "reviews"] }); queryClient.invalidateQueries({ queryKey: ["/api/items", id] }); queryClient.invalidateQueries({ queryKey: ["/api/items"] }); toast({ title: "Отзыв добавлен" }); }, onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }) });

  const createBookingMutation = useMutation({
    mutationFn: async (data: { itemId: string; startDate: string; endDate: string }) => {
      const res = await apiRequest("POST", "/api/bookings", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/items", id, "availability"] });
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
      .filter((b) => !["cancelled", "Cancelled", "rejected", "completed", "Completed"].includes(b.status))
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
    
    if (!canBookItem) {
      toast({ title: "Товар недоступен", description: "Этот товар сейчас нельзя забронировать", variant: "destructive" });
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
    
    if (hasDateError) {
      toast({ title: "Некорректные даты", description: dateError || "Дата окончания не может быть раньше даты начала", variant: "destructive" });
      return;
    }

    createBookingMutation.mutate({
      itemId: id!,
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    });
  };

  const days = startDate && endDate ? calculateRentalDays(startDate, endDate) : 0;
  const totalPrice = item ? days * item.pricePerDay : 0;
  const totalWithDeposit = item ? totalPrice + item.deposit : 0;
  const canBookItem = item?.status === "available";
  const dateError = getRentalDateError(startDate, endDate);
  const hasDateError = !!dateError;

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
              <div className="flex gap-2 flex-wrap mb-3"><Badge variant="secondary" className="rounded-lg">{item.brand}</Badge><Badge>{itemStatusLabels[item.status] || item.status}</Badge></div>
              <h1 className="text-2xl md:text-3xl font-bold">{item.title}</h1>
              <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Star className="h-4 w-4 fill-primary text-primary" />{item.reviewsCount ? `${item.averageRating?.toFixed(1)} из 5 • ${item.reviewsCount} отзывов` : "Пока нет отзывов"}</div>
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
            <Button variant={item.isFavorite ? "default" : "outline"} className="rounded-xl" disabled={!user || favoriteMutation.isPending} onClick={() => favoriteMutation.mutate()}><Heart className={`mr-2 h-4 w-4 ${item.isFavorite ? "fill-current" : ""}`} />{item.isFavorite ? "В избранном" : "Добавить в избранное"}</Button>

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
                            setEndDate(undefined);
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

                {hasDateError && <p className="text-sm text-destructive">{dateError}</p>}
                {startDate && endDate && Array.from({length: calculateRentalDays(startDate,endDate)}, (_,i)=>{const d=new Date(startDate); d.setDate(d.getDate()+i); return d;}).some(disabledDays) && <p className="text-sm text-destructive">Товар уже занят на выбранные даты</p>}
                {!canBookItem && <p className="text-sm text-destructive">Товар сейчас {itemStatusLabels[item.status]?.toLowerCase()} и недоступен для бронирования.</p>}
                {days > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Аренда ({days} {formatRussianDays(days)})</span>
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
        <Card className="mt-8 rounded-2xl border-border/50"><CardContent className="p-6 space-y-5"><h2 className="text-xl font-semibold">Отзывы</h2>{!reviews?.length ? <p className="text-muted-foreground">Пока нет отзывов</p> : <div className="space-y-3">{reviews.map((review) => <div key={review.id} className="rounded-xl border p-4"><div className="flex justify-between gap-3"><p className="font-medium">{review.user.name}</p><span className="text-sm text-primary">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div><p className="mt-2 text-sm text-muted-foreground">{review.text}</p><p className="mt-2 text-xs text-muted-foreground">{format(parseISO(review.createdAt), "d MMMM yyyy", { locale: ru })}</p></div>)}</div>}{user && myBookings?.some((b) => b.itemId === id && (b.paymentStatus === "paid" || ["completed", "Completed", "Paid"].includes(b.status))) && !reviews?.some((r) => r.userId === user.id) && <div className="rounded-xl border p-4 space-y-3"><h3 className="font-medium">Оставить отзыв</h3><select className="rounded-md border bg-background p-2" value={rating} onChange={(e)=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map((n)=><option key={n} value={n}>{n} звезд</option>)}</select><textarea className="w-full min-h-24 rounded-md border bg-background p-3" value={reviewText} onChange={(e)=>setReviewText(e.target.value)} placeholder="Поделитесь впечатлениями"/><Button onClick={()=>reviewMutation.mutate()} disabled={reviewMutation.isPending || reviewText.length<3}>Отправить отзыв</Button></div>}</CardContent></Card>
      </div>
    </div>
  );
}
