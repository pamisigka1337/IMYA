import { Link } from "wouter";
import { ShoppingBag, Mail, Phone, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-card border-t mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <ShoppingBag className="h-6 w-6" />
              <span className="font-semibold text-lg">ПРОКАТ</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Прокат брендовой одежды для особых случаев. Выглядите роскошно без лишних затрат.
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-4">Навигация</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Главная
                </Link>
              </li>
              <li>
                <Link href="/catalog" className="hover:text-foreground transition-colors">
                  Каталог
                </Link>
              </li>
              <li>
                <Link href="/account" className="hover:text-foreground transition-colors">
                  Личный кабинет
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-4">Категории</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/catalog?category=Платья" className="hover:text-foreground transition-colors">
                  Платья
                </Link>
              </li>
              <li>
                <Link href="/catalog?category=Костюмы" className="hover:text-foreground transition-colors">
                  Костюмы
                </Link>
              </li>
              <li>
                <Link href="/catalog?category=Верхняя одежда" className="hover:text-foreground transition-colors">
                  Верхняя одежда
                </Link>
              </li>
              <li>
                <Link href="/catalog?category=Аксессуары" className="hover:text-foreground transition-colors">
                  Аксессуары
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-4">Контакты</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>+7 (495) 123-45-67</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>info@prokat.ru</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>Москва, ул. Тверская, д. 12</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} ПРОКАТ. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
