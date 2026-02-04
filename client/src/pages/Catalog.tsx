import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { ItemCard } from "@/components/ItemCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SlidersHorizontal, Search, X } from "lucide-react";
import type { Item } from "@shared/schema";

const CATEGORIES = ["Платья", "Костюмы", "Верхняя одежда", "Аксессуары"];
const BRANDS = ["Gucci", "Prada", "Dior", "Chanel", "Valentino", "Balenciaga"];
const SIZES = ["XS", "S", "M", "L", "XL"];
const SORT_OPTIONS = [
  { value: "price-asc", label: "Цена: по возрастанию" },
  { value: "price-desc", label: "Цена: по убыванию" },
  { value: "name-asc", label: "Название: А-Я" },
  { value: "name-desc", label: "Название: Я-А" },
];

export default function Catalog() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(searchString);
  
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [brand, setBrand] = useState(searchParams.get("brand") || "");
  const [size, setSize] = useState(searchParams.get("size") || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") || "");
  const [sortBy, setSortBy] = useState(searchParams.get("sort") || "");

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const filteredItems = useMemo(() => {
    if (!items) return [];
    
    let result = items.filter((item) => item.isActive);
    
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(searchLower) ||
          item.brand.toLowerCase().includes(searchLower) ||
          item.description.toLowerCase().includes(searchLower)
      );
    }
    
    if (category) {
      result = result.filter((item) => item.category === category);
    }
    
    if (brand) {
      result = result.filter((item) => item.brand === brand);
    }
    
    if (size) {
      result = result.filter((item) => item.size === size);
    }
    
    if (minPrice) {
      result = result.filter((item) => item.pricePerDay >= parseInt(minPrice));
    }
    
    if (maxPrice) {
      result = result.filter((item) => item.pricePerDay <= parseInt(maxPrice));
    }
    
    if (sortBy) {
      result = [...result].sort((a, b) => {
        switch (sortBy) {
          case "price-asc":
            return a.pricePerDay - b.pricePerDay;
          case "price-desc":
            return b.pricePerDay - a.pricePerDay;
          case "name-asc":
            return a.title.localeCompare(b.title, "ru");
          case "name-desc":
            return b.title.localeCompare(a.title, "ru");
          default:
            return 0;
        }
      });
    }
    
    return result;
  }, [items, search, category, brand, size, minPrice, maxPrice, sortBy]);

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setBrand("");
    setSize("");
    setMinPrice("");
    setMaxPrice("");
    setSortBy("");
    setLocation("/catalog");
  };

  const hasFilters = search || category || brand || size || minPrice || maxPrice;

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="category">Категория</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="category" data-testid="select-category">
            <SelectValue placeholder="Все категории" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand">Бренд</Label>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger id="brand" data-testid="select-brand">
            <SelectValue placeholder="Все бренды" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все бренды</SelectItem>
            {BRANDS.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="size">Размер</Label>
        <Select value={size} onValueChange={setSize}>
          <SelectTrigger id="size" data-testid="select-size">
            <SelectValue placeholder="Все размеры" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все размеры</SelectItem>
            {SIZES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Цена за день (₽)</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder="От"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            data-testid="input-min-price"
          />
          <Input
            type="number"
            placeholder="До"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            data-testid="input-max-price"
          />
        </div>
      </div>

      {hasFilters && (
        <Button variant="outline" className="w-full" onClick={clearFilters} data-testid="button-clear-filters">
          <X className="h-4 w-4 mr-2" />
          Сбросить фильтры
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Каталог</h1>
          <p className="text-muted-foreground mt-2">
            {isLoading ? "Загрузка..." : `${filteredItems.length} товаров`}
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          <aside className="hidden md:block w-64 shrink-0">
            <div className="rounded-2xl border border-border/50 bg-card p-5">
              <h2 className="font-semibold text-lg mb-4">Фильтры</h2>
              <FilterContent />
            </div>
          </aside>

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Поиск по названию или бренду..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 rounded-xl bg-card border-border/50"
                  data-testid="input-search"
                />
              </div>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[200px] rounded-xl bg-card border-border/50" data-testid="select-sort">
                    <SelectValue placeholder="Сортировка" />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="md:hidden rounded-xl" data-testid="button-filters-mobile">
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left">
                    <SheetHeader>
                      <SheetTitle>Фильтры</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">
                      <FilterContent />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="rounded-2xl border border-border/50 bg-card p-4">
                    <Skeleton className="aspect-[4/3] rounded-xl" />
                    <Skeleton className="h-3 w-16 mt-4" />
                    <Skeleton className="h-5 w-full mt-2" />
                    <Skeleton className="h-4 w-32 mt-2" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredItems.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-lg">Товары не найдены</p>
                <p className="text-sm text-muted-foreground mt-1">Попробуйте изменить параметры поиска</p>
                {hasFilters && (
                  <Button variant="outline" className="mt-4 rounded-xl" onClick={clearFilters}>
                    Сбросить фильтры
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
