import { useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, CheckCircle, CreditCard, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Booking, Item } from "@shared/schema";
import { formatRussianDays } from "@shared/rental";

type BookingWithItem = Booking & { item: Item };
type PaymentMethod = "card" | "sbp";

const paymentStatusLabels: Record<string, string> = { pending: "Ожидает оплаты", paid: "Оплачено", failed: "Ошибка оплаты" };
const paymentMethodLabels: Record<string, string> = { card: "Банковская карта", sbp: "СБП" };
const STUDY_NOTICE = "Оплата используется в учебном режиме, реальные деньги не списываются";

function maskCardNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function maskExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function waitPaymentDelay() {
  return new Promise((resolve) => window.setTimeout(resolve, 1400));
}

export default function Payment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { toast } = useToast();
  const [successMessage, setSuccessMessage] = useState("");
  const [cardError, setCardError] = useState("");
  const [cardForm, setCardForm] = useState({ number: "", expiry: "", cvc: "", holder: "" });

  const { data: booking, isLoading } = useQuery<BookingWithItem>({
    queryKey: ["/api/bookings", bookingId, "payment"],
    enabled: !!bookingId,
  });

  const payMutation = useMutation({
    mutationFn: async (paymentMethod: PaymentMethod) => {
      await waitPaymentDelay();
      const res = await apiRequest("POST", `/api/bookings/${bookingId}/pay`, { paymentMethod });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings", bookingId, "payment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/my"] });
      const message = "Оплата прошла успешно";
      setSuccessMessage(message);
      setCardForm({ number: "", expiry: "", cvc: "", holder: "" });
      toast({ title: "Оплата успешна", description: message });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка оплаты", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-6 py-12"><Skeleton className="h-8 w-56 mb-6" /><Skeleton className="h-[520px] w-full rounded-2xl" /></div>;
  }

  if (!booking) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-2xl font-bold">Бронь не найдена</h1><Link href="/account"><Button className="mt-4 rounded-xl">Вернуться в личный кабинет</Button></Link></div></div>;
  }

  const startDate = parseISO(booking.startDate);
  const endDate = parseISO(booking.endDate);
  const total = booking.totalPrice + booking.deposit;
  const isPaid = booking.paymentStatus === "paid";
  const validateCardForm = () => {
    const digits = cardForm.number.replace(/\D/g, "");
    if (digits.length !== 16 || /^0+$/.test(digits)) return "Введите номер карты полностью";
    if (!/^\d{2}\/\d{2}$/.test(cardForm.expiry)) return "Введите срок действия карты";
    if (!/^\d{3}$/.test(cardForm.cvc)) return "Введите CVC";
    if (cardForm.holder.trim().length < 2) return "Введите имя держателя карты";
    return "";
  };

  const handleCardPayment = () => {
    const error = validateCardForm();
    setCardError(error);
    if (error) return;
    payMutation.mutate("card");
  };

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="mx-auto max-w-4xl px-6">
        <Link href="/account" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition"><ArrowLeft className="h-4 w-4 mr-1" />Мои бронирования</Link>
        <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground flex gap-3">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
          <div><p className="font-semibold">Оплата</p><p className="text-muted-foreground">{STUDY_NOTICE}. Данные карты не сохраняются и не отправляются на сервер.</p></div>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.15fr] gap-6">
          <Card className="rounded-2xl border-border/50 h-fit">
            <CardHeader><CardTitle>Детали оплаты</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <img src={booking.item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=200&h=250&fit=crop"} alt={booking.item.title} className="h-24 w-20 rounded-xl object-cover border" />
                <div><p className="text-sm text-muted-foreground">{booking.item.brand}</p><h2 className="font-semibold">{booking.item.title}</h2><p className="text-sm text-muted-foreground">Размер: {booking.item.size}</p></div>
              </div>
              <div className="space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Даты аренды</span><span>{format(startDate, "d MMM", { locale: ru })} — {format(endDate, "d MMM yyyy", { locale: ru })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Количество дней</span><span>{booking.days} {formatRussianDays(booking.days)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Аренда</span><span>{booking.totalPrice.toLocaleString("ru-RU")} ₽</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Залог</span><span>{booking.deposit.toLocaleString("ru-RU")} ₽</span></div>
                <div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Итого</span><span>{total.toLocaleString("ru-RU")} ₽</span></div>
              </div>
              <div className="flex flex-wrap gap-2 border-t pt-4"><Badge variant={isPaid ? "default" : "secondary"}>{paymentStatusLabels[booking.paymentStatus] || booking.paymentStatus}</Badge>{booking.paymentMethod && <Badge variant="outline">{paymentMethodLabels[booking.paymentMethod] || booking.paymentMethod}</Badge>}</div>
              {booking.paidAt && <p className="text-sm text-muted-foreground">Дата оплаты: {format(parseISO(booking.paidAt), "d MMMM yyyy, HH:mm", { locale: ru })}</p>}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardHeader><CardTitle>{isPaid ? "Бронирование оплачено" : "Выберите способ оплаты"}</CardTitle></CardHeader>
            <CardContent>
              {isPaid || successMessage ? (
                <div className="text-center py-10 space-y-4"><CheckCircle className="h-14 w-14 text-green-600 mx-auto" /><h3 className="text-xl font-semibold">{successMessage || "Оплачено"}</h3><p className="text-muted-foreground">{STUDY_NOTICE}.</p><Link href="/account"><Button className="rounded-xl">Вернуться в личный кабинет</Button></Link></div>
              ) : (
                <Tabs defaultValue="card">
                  <TabsList className="grid w-full grid-cols-2 rounded-xl"><TabsTrigger value="card">Оплата картой</TabsTrigger><TabsTrigger value="sbp">Оплата через СБП</TabsTrigger></TabsList>
                  <TabsContent value="card" className="mt-6 space-y-5">
                    <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 p-5 text-white shadow-lg"><p className="text-xs opacity-70">КАРТА</p><p className="mt-8 text-xl tracking-[0.25em]">{cardForm.number || "0000 0000 0000 0000"}</p><div className="mt-6 flex justify-between text-sm"><span>{cardForm.holder || "ВЛАДЕЛЕЦ КАРТЫ"}</span><span>{cardForm.expiry || "ММ/ГГ"}</span></div></div>
                    <div className="grid gap-4">
                      <div><Label htmlFor="card-number">Номер карты</Label><Input id="card-number" inputMode="numeric" value={cardForm.number} onChange={(e) => setCardForm((f) => ({ ...f, number: maskCardNumber(e.target.value) }))} placeholder="0000 0000 0000 0000" /></div>
                      <div className="grid grid-cols-2 gap-4"><div><Label htmlFor="expiry">Срок действия</Label><Input id="expiry" inputMode="numeric" value={cardForm.expiry} onChange={(e) => setCardForm((f) => ({ ...f, expiry: maskExpiry(e.target.value) }))} placeholder="ММ/ГГ" /></div><div><Label htmlFor="cvc">CVC</Label><Input id="cvc" inputMode="numeric" value={cardForm.cvc} onChange={(e) => setCardForm((f) => ({ ...f, cvc: e.target.value.replace(/\D/g, "").slice(0, 3) }))} placeholder="123" /></div></div>
                      <div><Label htmlFor="holder">Имя держателя</Label><Input id="holder" value={cardForm.holder} onChange={(e) => setCardForm((f) => ({ ...f, holder: e.target.value.toUpperCase().slice(0, 32) }))} placeholder="IVAN IVANOV" /></div>
                    </div>
                    <p className="text-xs text-muted-foreground">{STUDY_NOTICE}. Поля карты используются только в браузере и не отправляются на сервер.</p>
                    {cardError && <p className="text-sm text-destructive">{cardError}</p>}
                    <Button className="w-full rounded-xl" size="lg" disabled={payMutation.isPending} onClick={handleCardPayment}><CreditCard className="mr-2 h-4 w-4" />{payMutation.isPending ? "Обработка оплаты..." : `Оплатить ${total.toLocaleString("ru-RU")} ₽`}</Button>
                  </TabsContent>
                  <TabsContent value="sbp" className="mt-6 space-y-5 text-center">
                    <h3 className="text-lg font-semibold">Оплата через СБП</h3>
                    <div className="mx-auto grid h-48 w-48 grid-cols-7 gap-1 rounded-2xl border bg-white p-4">{Array.from({ length: 49 }).map((_, i) => <span key={i} className={(i * 7 + i) % 5 === 0 || i < 14 || i % 7 < 2 ? "bg-zinc-900" : "bg-zinc-200"} />)}</div>
                    <QrCode className="h-6 w-6 mx-auto text-primary" />
                    <p className="font-medium">Отсканируйте QR-код в приложении банка.</p>
                    <p className="text-sm text-muted-foreground">{STUDY_NOTICE}.</p>
                    <Button className="w-full rounded-xl" size="lg" disabled={payMutation.isPending} onClick={() => payMutation.mutate("sbp")}>{payMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Я оплатил через СБП</Button>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
