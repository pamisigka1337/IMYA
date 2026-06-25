import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Pencil, Package, ShoppingBag, Shield, Trash2, BarChart3 } from "lucide-react";
import type { Item, Booking, User } from "@shared/schema";

type BookingWithItem = Booking & { item: Item; user: User };

const itemFormSchema = z.object({
  brand: z.string().min(1, "Укажите бренд"),
  title: z.string().min(1, "Укажите название"),
  category: z.string().min(1, "Выберите категорию"),
  size: z.string().min(1, "Укажите размер"),
  pricePerDay: z.coerce.number().min(1, "Укажите цену"),
  deposit: z.coerce.number().min(0, "Укажите залог"),
  condition: z.string().min(1, "Укажите состояние"),
  description: z.string().min(1, "Добавьте описание"),
  images: z.string().optional(),
  isActive: z.boolean().default(true),
  status: z.enum(["available", "booked", "unavailable"]).default("available"),
});

type ItemFormData = z.infer<typeof itemFormSchema>;

const CATEGORIES = ["Платья", "Костюмы", "Верхняя одежда", "Аксессуары"];
const CONDITIONS = ["Новое", "Отличное", "Хорошее"];
const SIZES = ["XS", "S", "M", "L", "XL"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function parseImageInput(value?: string) {
  if (!value) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  const hasDataUrl = trimmed.includes("data:image/");
  const separator = hasDataUrl ? /\n+/ : /[\n,]+/;
  return trimmed.split(separator).map((image) => image.trim()).filter(Boolean);
}

const statusLabels: Record<string, string> = { pending: "Ожидает подтверждения", confirmed: "Подтверждено", rejected: "Отклонено", completed: "Завершено", Pending: "Ожидает оплаты", Paid: "Оплачено", Active: "Активно", Completed: "Завершено", Cancelled: "Отменено" };
const itemStatusLabels: Record<string, string> = { available: "Доступен", booked: "Забронирован", unavailable: "Недоступен" };
type AdminStats = { totalItems: number; availableItems: number; bookedItems: number; unavailableItems: number; totalBookings: number; pendingBookings: number; confirmedBookings: number; completedBookings: number; estimatedRevenue: number };

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const { data: items, isLoading: itemsLoading } = useQuery<Item[]>({
    queryKey: ["/api/admin/items"],
    enabled: !!user && user.role === "admin",
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingWithItem[]>({
    queryKey: ["/api/admin/bookings"],
    enabled: !!user && user.role === "admin",
  });

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user && user.role === "admin",
  });

  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      brand: "",
      title: "",
      category: "",
      size: "",
      pricePerDay: 0,
      deposit: 0,
      condition: "Отличное",
      description: "",
      images: "",
      isActive: true,
      status: "available",
    },
  });


  const uploadSelectedImages = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return [];

    const formData = new FormData();
    Array.from(selectedFiles).forEach((file) => {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new Error("Можно загружать только PNG, JPG, JPEG или WEBP");
      }
      if (file.size > MAX_IMAGE_SIZE) {
        throw new Error("Размер изображения не должен превышать 10 МБ");
      }
      formData.append("images", file);
    });

    const res = await fetch("/api/admin/uploads", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        throw new Error(parsed.message || text);
      } catch (error) {
        if (error instanceof Error && error.message !== text) throw error;
        throw new Error(text);
      }
    }

    const data = (await res.json()) as { urls: string[] };
    return data.urls;
  };

  const uploadImagesToItem = async (id: string) => {
    if (!selectedFiles || selectedFiles.length === 0) return null;

    const formData = new FormData();
    Array.from(selectedFiles).forEach((file) => {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new Error("Можно загружать только PNG, JPG, JPEG или WEBP");
      }
      if (file.size > MAX_IMAGE_SIZE) {
        throw new Error("Размер изображения не должен превышать 10 МБ");
      }
      formData.append("images", file);
    });

    const res = await fetch(`/api/admin/items/${id}/images`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        throw new Error(parsed.message || text);
      } catch (error) {
        if (error instanceof Error && error.message !== text) throw error;
        throw new Error(text);
      }
    }

    return (await res.json()) as Item;
  };

  const buildItemPayload = async (data: ItemFormData) => {
    const urlImages = parseImageInput(data.images);
    const uploadedImages = editingItem ? [] : await uploadSelectedImages();
    return { ...data, images: [...urlImages, ...uploadedImages] };
  };

  const createItemMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      const payload = await buildItemPayload(data);
      const res = await apiRequest("POST", "/api/admin/items", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setIsDialogOpen(false);
      form.reset();
      setSelectedFiles(null);
      toast({ title: "Товар создан" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ItemFormData }) => {
      const payload = await buildItemPayload(data);
      const res = await apiRequest("PATCH", `/api/admin/items/${id}`, payload);
      const updatedItem = (await res.json()) as Item;
      return (await uploadImagesToItem(id)) ?? updatedItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setIsDialogOpen(false);
      setEditingItem(null);
      form.reset();
      setSelectedFiles(null);
      toast({ title: "Товар обновлён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });


  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/items/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Товар удалён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка удаления", description: error.message, variant: "destructive" });
    },
  });

  const handleDeleteItem = (item: Item) => {
    if (!window.confirm("Вы точно хотите удалить товар?")) return;
    deleteItemMutation.mutate(item.id);
  };

  const updateBookingStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/bookings/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Статус обновлён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const openEditDialog = (item: Item) => {
    setEditingItem(item);
    form.reset({
      brand: item.brand,
      title: item.title,
      category: item.category,
      size: item.size,
      pricePerDay: item.pricePerDay,
      deposit: item.deposit,
      condition: item.condition,
      description: item.description,
      images: item.images.join("\n"),
      isActive: item.isActive,
      status: itemFormSchema.shape.status.parse(item.status),
    });
    setSelectedFiles(null);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    form.reset({
      brand: "",
      title: "",
      category: "",
      size: "",
      pricePerDay: 0,
      deposit: 0,
      condition: "Отличное",
      description: "",
      images: "",
      isActive: true,
      status: "available",
    });
    setSelectedFiles(null);
    setIsDialogOpen(true);
  };

  const onSubmit = (data: ItemFormData) => {
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Загрузка...</div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Доступ запрещён</h1>
          <p className="text-muted-foreground mt-2">Эта страница доступна только администраторам</p>
          <Link href="/">
            <Button className="mt-4 rounded-xl">На главную</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl md:text-3xl font-bold">Админ-панель</h1>
        </div>

        <Tabs defaultValue="items">
          <TabsList className="mb-6">
            <TabsTrigger value="items" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Товары
            </TabsTrigger>
            <TabsTrigger value="bookings" className="gap-2">
              <Package className="h-4 w-4" />
              Все бронирования
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Статистика
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                <CardTitle>Управление товарами</CardTitle>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openCreateDialog} className="rounded-xl" data-testid="button-add-item">
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить товар
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingItem ? "Редактировать товар" : "Новый товар"}</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="brand"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Бренд</FormLabel>
                                <FormControl>
                                  <Input {...field} data-testid="input-brand" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Категория</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-category">
                                      <SelectValue placeholder="Выберите" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {CATEGORIES.map((cat) => (
                                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Название</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-title" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="size"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Размер</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-size">
                                      <SelectValue placeholder="Выберите" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {SIZES.map((s) => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="condition"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Состояние</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-condition">
                                      <SelectValue placeholder="Выберите" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {CONDITIONS.map((c) => (
                                      <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="pricePerDay"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Цена/день (₽)</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} data-testid="input-price" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="deposit"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Залог (₽)</FormLabel>
                                <FormControl>
                                  <Input type="number" {...field} data-testid="input-deposit" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Описание</FormLabel>
                              <FormControl>
                                <Textarea {...field} data-testid="input-description" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="images"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>URL или сохранённые изображения (каждое с новой строки)</FormLabel>
                              <FormControl>
                                <Textarea {...field} placeholder="https://..." data-testid="input-images" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="space-y-2">
                          <FormLabel htmlFor="image-files">Загрузить фото с компьютера</FormLabel>
                          <Input
                            id="image-files"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={(event) => setSelectedFiles(event.target.files)}
                            data-testid="input-image-files"
                          />
                          <p className="text-xs text-muted-foreground">
                            Можно добавить несколько PNG, JPG, JPEG или WEBP. Максимум 10 МБ на файл.
                            URL-картинки выше продолжат работать, а загруженные файлы сохранятся в базе.
                          </p>
                        </div>
                        <FormField
                          control={form.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Статус товара</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger data-testid="select-item-status"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{Object.entries(itemStatusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center justify-between rounded-xl border border-border/50 p-3">
                              <FormLabel className="cursor-pointer">Активен</FormLabel>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-active"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full rounded-xl"
                          disabled={createItemMutation.isPending || updateItemMutation.isPending}
                          data-testid="button-save-item"
                        >
                          {editingItem ? "Сохранить" : "Создать"}
                        </Button>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {itemsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : !items || items.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Нет товаров</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-3 border border-border/50 rounded-xl hover-elevate"
                        data-testid={`admin-item-${item.id}`}
                      >
                        <div className="w-12 h-14 rounded-lg overflow-hidden border border-border/50 shrink-0">
                          <img
                            src={item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=100&h=120&fit=crop"}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">{item.title}</span>
                            {!item.isActive && <Badge variant="secondary">Неактивен</Badge>}<Badge variant="outline">{itemStatusLabels[item.status] || item.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {item.brand} • {item.category} • {item.size} • {item.pricePerDay.toLocaleString("ru-RU")} ₽/день
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-xl"
                            onClick={() => openEditDialog(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="rounded-xl gap-2"
                            disabled={deleteItemMutation.isPending}
                            onClick={() => handleDeleteItem(item)}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                            Удалить
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bookings">
            <Card className="rounded-2xl border-border/50">
              <CardHeader>
                <CardTitle>Все бронирования</CardTitle>
              </CardHeader>
              <CardContent>
                {bookingsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                ) : !bookings || bookings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Нет бронирований</p>
                ) : (
                  <div className="space-y-3">
                    {bookings.map((booking) => (
                      <div
                        key={booking.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-border/50 rounded-xl hover-elevate"
                        data-testid={`admin-booking-${booking.id}`}
                      >
                        <div className="flex gap-3 flex-1 min-w-0">
                          <div className="w-12 h-14 rounded-lg overflow-hidden border border-border/50 shrink-0">
                            <img
                              src={booking.item.images[0] || "https://images.unsplash.com/photo-1558171813-4c088753af8f?w=100&h=120&fit=crop"}
                              alt={booking.item.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{booking.item.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {booking.user?.name || "Пользователь"} • {format(parseISO(booking.startDate), "d MMM", { locale: ru })} - {format(parseISO(booking.endDate), "d MMM", { locale: ru })}
                            </p>
                            <p className="text-sm font-medium text-primary mt-1">
                              {booking.days} дн. • {booking.totalPrice.toLocaleString("ru-RU")} ₽
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{statusLabels[booking.status] || booking.status}</Badge>
                          <Button size="sm" onClick={() => updateBookingStatusMutation.mutate({ id: booking.id, status: "confirmed" })} disabled={updateBookingStatusMutation.isPending || booking.status === "confirmed"}>Подтвердить</Button>
                          <Button size="sm" variant="outline" onClick={() => updateBookingStatusMutation.mutate({ id: booking.id, status: "rejected" })} disabled={updateBookingStatusMutation.isPending || booking.status === "rejected"}>Отклонить</Button>
                          <Button size="sm" variant="secondary" onClick={() => updateBookingStatusMutation.mutate({ id: booking.id, status: "completed" })} disabled={updateBookingStatusMutation.isPending || booking.status === "completed"}>Завершить</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats && Object.entries({
                "Всего товаров": stats.totalItems,
                "Доступных товаров": stats.availableItems,
                "Забронированных товаров": stats.bookedItems,
                "Недоступных товаров": stats.unavailableItems,
                "Всего бронирований": stats.totalBookings,
                "В ожидании": stats.pendingBookings,
                "Подтверждённых": stats.confirmedBookings,
                "Завершённых": stats.completedBookings,
                "Примерный доход": `${stats.estimatedRevenue.toLocaleString("ru-RU")} ₽`,
              }).map(([label, value]) => (
                <Card key={label} className="rounded-2xl border-border/50"><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></CardContent></Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
