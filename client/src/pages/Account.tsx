import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, Calendar, CreditCard, Heart, Package, RotateCcw, Shield, User, Wallet, X } from "lucide-react";
import type { Booking, Item, NotificationSettings } from "@shared/schema";
import { formatRussianDays } from "@shared/rental";

type BookingWithItem = Booking & { item: Item };
type ProfileResponse = {
  user: { id: string; name: string; email: string; role: string; phone?: string | null; city?: string | null; preferredPickupPoint?: string | null; notificationSettings: NotificationSettings };
  stats: { totalBookings: number; activeBookings: number; paidBookings: number; cancelledBookings: number; paidBookingsAmount: number };
  paymentHistory: { id: string; paidAt: string; amount: number; paymentMethod: string | null; paymentStatus: string; refundStatus: string | null; itemTitle: string }[];
};

const paymentStatusLabels: Record<string, string> = { pending: "Ожидает оплаты", paid: "Оплачено", failed: "Ошибка оплаты", refund_pending: "Возврат оформлен", refunded: "Возвращено" };
const paymentMethodLabels: Record<string, string> = { card: "Карта", sbp: "СБП" };
const statusLabels: Record<string, string> = { pending: "Ожидает подтверждения", confirmed: "Подтверждено", rejected: "Отклонено", completed: "Завершено", cancelled: "Отменено", Pending: "Ожидает оплаты", Paid: "Оплачено", Active: "Активно", Completed: "Завершено", Cancelled: "Отменено" };
const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = { pending: "secondary", confirmed: "default", rejected: "destructive", completed: "outline", cancelled: "destructive", Pending: "secondary", Paid: "default", Active: "default", Completed: "outline", Cancelled: "destructive" };
const filters = ["Все", "Ожидают оплаты", "Оплачено", "Отменено", "Возврат"] as const;

export default function Account() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<(typeof filters)[number]>("Все");
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", city: "", preferredPickupPoint: "", notificationSettings: { bookingConfirmed: true, refunds: true, paymentStatus: true } });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", repeatPassword: "" });

  const { data: profile } = useQuery<ProfileResponse>({ queryKey: ["/api/profile"], enabled: !!user });
  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingWithItem[]>({ queryKey: ["/api/bookings/my"], enabled: !!user, refetchInterval: 30000 });
  const { data: favorites } = useQuery<Item[]>({ queryKey: ["/api/favorites"], enabled: !!user });

  useEffect(() => {
    if (profile?.user) setProfileForm({ name: profile.user.name, phone: profile.user.phone || "", city: profile.user.city || "", preferredPickupPoint: profile.user.preferredPickupPoint || "", notificationSettings: profile.user.notificationSettings });
  }, [profile]);

  const saveProfileMutation = useMutation({ mutationFn: async () => (await apiRequest("PATCH", "/api/profile", profileForm)).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/profile"] }); toast({ title: "Профиль сохранён" }); }, onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }) });
  const passwordMutation = useMutation({ mutationFn: async () => (await apiRequest("PATCH", "/api/profile/password", passwordForm)).json(), onSuccess: () => { setPasswordForm({ currentPassword: "", newPassword: "", repeatPassword: "" }); toast({ title: "Пароль изменён" }); }, onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }) });
  const removeFavoriteMutation = useMutation({ mutationFn: async (itemId: string) => (await apiRequest("DELETE", `/api/favorites/${itemId}`)).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/favorites"] }); queryClient.invalidateQueries({ queryKey: ["/api/items"] }); toast({ title: "Удалено из избранного" }); } });
  const cancelMutation = useMutation({ mutationFn: async (bookingId: string) => (await apiRequest("POST", `/api/bookings/${bookingId}/cancel`)).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bookings/my"] }); queryClient.invalidateQueries({ queryKey: ["/api/profile"] }); toast({ title: "Бронь отменена", description: "Если бронь была оплачена, возврат оформлен автоматически." }); }, onError: (error: Error) => toast({ title: "Ошибка", description: error.message, variant: "destructive" }) });

  const visibleBookings = (bookings || []).filter((booking) => filter === "Все" || (filter === "Ожидают оплаты" && booking.paymentStatus === "pending") || (filter === "Оплачено" && booking.paymentStatus === "paid") || (filter === "Отменено" && ["cancelled", "rejected", "Cancelled"].includes(booking.status)) || (filter === "Возврат" && ["pending", "refunded"].includes(booking.refundStatus || "")));

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse">Загрузка...</div></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold">Требуется авторизация</h1><p className="text-muted-foreground mt-2">Войдите в аккаунт для просмотра личного кабинета</p><Link href="/login"><Button className="mt-4 rounded-xl">Войти</Button></Link></div></div>;

  return <div className="min-h-screen py-8 md:py-12"><div className="mx-auto max-w-6xl px-6 space-y-8">
    <div className="flex items-center gap-4"><div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center ring-1 ring-primary/40"><User className="h-7 w-7 text-primary" /></div><div><h1 className="text-2xl font-bold">{profile?.user.name || user.name}</h1><p className="text-muted-foreground text-sm">{user.email}</p></div></div>

    <div className="grid md:grid-cols-5 gap-3">{[["Всего", profile?.stats.totalBookings], ["Активные", profile?.stats.activeBookings], ["Оплаченные", profile?.stats.paidBookings], ["Отменённые", profile?.stats.cancelledBookings], ["Сумма оплат", `${(profile?.stats.paidBookingsAmount || 0).toLocaleString("ru-RU")} ₽`]].map(([label, value]) => <Card key={label} className="rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value ?? 0}</p></CardContent></Card>)}</div>

    <div className="grid lg:grid-cols-[1fr_1.35fr] gap-6">
      <div className="space-y-6">
        <Card className="rounded-2xl"><CardHeader><CardTitle className="flex gap-2"><User className="h-5 w-5" />Настройки профиля</CardTitle></CardHeader><CardContent className="space-y-5">
          <div className="grid gap-3"><h3 className="font-semibold">Личные данные</h3><Label>Имя<Input value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} /></Label><Label>Email<Input value={user.email} disabled /></Label><Label>Телефон<Input value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} /></Label><Label>Город<Input value={profileForm.city} onChange={(e) => setProfileForm((f) => ({ ...f, city: e.target.value }))} /></Label><Label>Предпочитаемый пункт выдачи<Input value={profileForm.preferredPickupPoint} onChange={(e) => setProfileForm((f) => ({ ...f, preferredPickupPoint: e.target.value }))} /></Label></div>
          <div className="space-y-3 border-t pt-4"><h3 className="font-semibold flex gap-2"><Bell className="h-4 w-4" />Уведомления</h3>{[["bookingConfirmed", "О подтверждении бронирования"], ["refunds", "О возврате"], ["paymentStatus", "О статусе оплаты"]].map(([key, label]) => <div key={key} className="flex items-center justify-between"><span className="text-sm">{label}</span><Switch checked={profileForm.notificationSettings[key as keyof NotificationSettings]} onCheckedChange={(checked) => setProfileForm((f) => ({ ...f, notificationSettings: { ...f.notificationSettings, [key]: checked } }))} /></div>)}</div>
          <Button className="w-full rounded-xl" onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>Сохранить настройки</Button>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardHeader><CardTitle className="flex gap-2"><Shield className="h-5 w-5" />Безопасность</CardTitle></CardHeader><CardContent className="space-y-3"><Input type="password" placeholder="Текущий пароль" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))} /><Input type="password" placeholder="Новый пароль" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))} /><Input type="password" placeholder="Повтор нового пароля" value={passwordForm.repeatPassword} onChange={(e) => setPasswordForm((f) => ({ ...f, repeatPassword: e.target.value }))} /><Button variant="outline" className="w-full rounded-xl" onClick={() => passwordMutation.mutate()} disabled={passwordMutation.isPending}>Изменить пароль</Button></CardContent></Card>
      </div>

      <div className="space-y-6"><Card className="rounded-2xl border-border/50"><CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Мои бронирования</CardTitle></CardHeader><CardContent><Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}><TabsList className="mb-4 flex h-auto flex-wrap justify-start rounded-xl">{filters.map((item) => <TabsTrigger key={item} value={item}>{item}</TabsTrigger>)}</TabsList></Tabs>{bookingsLoading ? <Skeleton className="h-40 w-full" /> : visibleBookings.length === 0 ? <div className="text-center py-8"><Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Бронирований в этом разделе нет</p></div> : <div className="space-y-4">{visibleBookings.map((booking) => <BookingCard key={booking.id} booking={booking} onCancel={() => cancelMutation.mutate(booking.id)} cancelling={cancelMutation.isPending} />)}</div>}</CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><CardTitle className="flex gap-2"><Heart className="h-5 w-5" />Избранное</CardTitle></CardHeader><CardContent className="space-y-3">{!favorites?.length ? <p className="text-sm text-muted-foreground">У вас пока нет избранных товаров</p> : favorites.map((item) => <div key={item.id} className="grid grid-cols-[64px_1fr] gap-3 rounded-xl border p-3"><img src={item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=120&h=140&fit=crop"} alt={item.title} className="h-20 w-16 rounded-lg object-cover"/><div><p className="text-xs text-muted-foreground">{item.brand}</p><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.pricePerDay.toLocaleString("ru-RU")} ₽/день • {item.status}</p><div className="mt-2 flex gap-2"><Link href={`/item/${item.id}`}><Button size="sm" variant="outline">Перейти к товару</Button></Link><Button size="sm" variant="ghost" onClick={()=>removeFavoriteMutation.mutate(item.id)}>Удалить</Button></div></div></div>)}</CardContent></Card>
      <Card className="rounded-2xl"><CardHeader><CardTitle className="flex gap-2"><Wallet className="h-5 w-5" />История оплат</CardTitle></CardHeader><CardContent className="space-y-3">{!profile?.paymentHistory.length ? <p className="text-sm text-muted-foreground">Платежей пока нет.</p> : profile.paymentHistory.map((payment) => <div key={payment.id} className="rounded-xl border p-3 text-sm"><div className="flex justify-between gap-3"><span className="font-medium">{payment.itemTitle}</span><Badge>{paymentStatusLabels[payment.paymentStatus] || payment.paymentStatus}</Badge></div><p className="text-muted-foreground">{format(parseISO(payment.paidAt), "d MMMM yyyy, HH:mm", { locale: ru })} • {payment.amount.toLocaleString("ru-RU")} ₽ • {paymentMethodLabels[payment.paymentMethod || ""] || "—"}</p></div>)}</CardContent></Card></div>
    </div>
  </div></div>;
}

function BookingCard({ booking, onCancel, cancelling }: { booking: BookingWithItem; onCancel: () => void; cancelling: boolean }) {
  const canCancel = !["completed", "Completed", "cancelled", "Cancelled", "rejected"].includes(booking.status);
  return <div className="grid gap-4 rounded-2xl border border-border/50 p-4 hover-elevate md:grid-cols-[80px_1fr]" data-testid={`booking-item-${booking.id}`}><Link href={`/item/${booking.item.id}`}><img src={booking.item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=200&h=250&fit=crop"} alt={booking.item.title} className="h-24 w-20 rounded-xl object-cover border" /></Link><div className="min-w-0 space-y-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">{booking.item.brand}</p><h3 className="font-medium">{booking.item.title}</h3></div><Badge variant={statusColors[booking.status]}>{statusLabels[booking.status] || booking.status}</Badge></div><div className="flex items-center gap-1 text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{format(parseISO(booking.startDate), "d MMM", { locale: ru })} — {format(parseISO(booking.endDate), "d MMM yyyy", { locale: ru })}</div><div className="rounded-xl border bg-secondary/30 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-muted-foreground">Статус оплаты: {paymentStatusLabels[booking.paymentStatus] || booking.paymentStatus}</p><p className="font-semibold">Итого: {(booking.totalPrice + booking.deposit).toLocaleString("ru-RU")} ₽</p>{booking.paymentMethod && <p className="text-sm text-muted-foreground">Способ оплаты: {paymentMethodLabels[booking.paymentMethod] || booking.paymentMethod}</p>}</div><Badge variant={booking.paymentStatus === "paid" ? "default" : "secondary"}>{paymentStatusLabels[booking.paymentStatus] || booking.paymentStatus}</Badge></div>{booking.refundStatus === "pending" && <p className="mt-3 rounded-lg bg-amber-100 p-2 text-sm text-amber-900"><RotateCcw className="mr-1 inline h-4 w-4" />Возврат оформлен. Деньги вернутся в течение 2–3 минут.</p>}{booking.refundStatus === "refunded" && <p className="mt-3 rounded-lg bg-green-100 p-2 text-sm text-green-900">Деньги возвращены.</p>}</div><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-semibold">{booking.days} {formatRussianDays(booking.days)} • аренда {booking.totalPrice.toLocaleString("ru-RU")} ₽</span><div className="flex gap-2">{booking.paymentStatus === "pending" && <Link href={`/payment/${booking.id}`}><Button size="sm" data-testid={`button-pay-${booking.id}`}><CreditCard className="mr-2 h-4 w-4" />Оплатить</Button></Link>}{booking.paymentStatus === "paid" && <Link href={`/receipt/${booking.id}`}><Button size="sm" variant="outline">Скачать квитанцию</Button></Link>}{canCancel && <Button size="sm" variant="outline" onClick={onCancel} disabled={cancelling} data-testid={`button-cancel-${booking.id}`}><X className="mr-2 h-4 w-4" />Отменить бронирование</Button>}</div></div></div></div>;
}
