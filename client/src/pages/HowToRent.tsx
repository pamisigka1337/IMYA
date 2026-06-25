import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Shirt, Calendar, ClipboardCheck, CreditCard, MapPin, RotateCcw } from "lucide-react";

const steps = [
  { Icon: Search, title: "Выберите вещь", text: "Найдите бренд, размер и стиль в каталоге." },
  { Icon: Shirt, title: "Откройте карточку", text: "Посмотрите фото, описание, рейтинг и занятость." },
  { Icon: Calendar, title: "Укажите даты", text: "Выберите свободный период аренды." },
  { Icon: ClipboardCheck, title: "Оформите бронирование", text: "Проверьте стоимость и залог." },
  { Icon: CreditCard, title: "Оплатите заказ", text: "Оплатите картой или СБП." },
  { Icon: MapPin, title: "Заберите вещь", text: "Получите заказ в пункте выдачи." },
  { Icon: RotateCcw, title: "Верните вещь", text: "Верните после окончания аренды." },
];
const faq = [["Можно ли забронировать занятую дату?", "Нет, календарь блокирует уже занятые даты."], ["Когда возвращается залог?", "После возврата вещи и проверки состояния."], ["Где взять квитанцию?", "После оплаты она доступна в личном кабинете."]];

export default function HowToRent() {
  return <div className="min-h-screen py-10"><div className="mx-auto max-w-6xl px-6 space-y-8"><div><Badge>IMYA guide</Badge><h1 className="mt-3 text-3xl font-bold">Как арендовать</h1><p className="text-muted-foreground mt-2">Семь простых шагов до идеального образа.</p></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{steps.map(({ Icon, title, text }, i) => <Card key={title} className="rounded-2xl border-border/50"><CardContent className="p-5"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div><p className="text-sm text-primary">Шаг {i + 1}</p><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{text}</p></CardContent></Card>)}</div><Card className="rounded-2xl"><CardContent className="p-6"><h2 className="text-xl font-semibold mb-4">Частые вопросы</h2><div className="grid md:grid-cols-3 gap-4">{faq.map(([q, a]) => <div key={q} className="rounded-xl border p-4"><h3 className="font-medium">{q}</h3><p className="mt-2 text-sm text-muted-foreground">{a}</p></div>)}</div></CardContent></Card></div></div>;
}
