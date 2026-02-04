import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { User, Menu, X, LogOut, Shield } from "lucide-react";
import { useState } from "react";
import imyaLogo from "@assets/c10116e7-7113-4aac-ab5a-08b9ba69014a-md_1770198512860.jpeg";

function Logo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <img src={imyaLogo} alt="IMYA" className="h-10 w-auto" />
    </div>
  );
}

export function Header() {
  const { user, logout, isLoading } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/catalog", label: "Каталог" },
    { href: "/account", label: "Кабинет" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center justify-between gap-4 h-16">
          <Link href="/" className="hover:opacity-90 transition">
            <Logo />
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-foreground ${
                  location === link.href ? "text-foreground" : "text-muted-foreground"
                }`}
                data-testid={`link-nav-${link.label.toLowerCase()}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <div className="h-9 w-20 bg-muted animate-pulse rounded-xl" />
            ) : user ? (
              <>
                {user.role === "admin" && (
                  <Link href="/admin">
                    <Button variant="ghost" size="sm" className="rounded-xl" data-testid="link-admin">
                      <Shield className="h-4 w-4 mr-1" />
                      Админ
                    </Button>
                  </Link>
                )}
                <Link href="/account">
                  <Button variant="ghost" size="sm" className="rounded-xl" data-testid="link-account">
                    <User className="h-4 w-4 mr-1" />
                    {user.name}
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="rounded-xl" onClick={logout} data-testid="button-logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="rounded-xl" data-testid="link-login">
                    Вход
                  </Button>
                </Link>
                <Link href="/catalog">
                  <Button size="sm" className="rounded-xl" data-testid="link-catalog-cta">
                    В каталог
                  </Button>
                </Link>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-xl"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                    location === link.href
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="border-t border-border/50 my-2" />
              {user ? (
                <>
                  {user.role === "admin" && (
                    <Link
                      href="/admin"
                      className="px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary/50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Админ-панель
                    </Link>
                  )}
                  <button
                    className="px-3 py-2 rounded-xl text-sm font-medium text-left text-muted-foreground hover:bg-secondary/50"
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary/50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Вход
                  </Link>
                  <Link
                    href="/register"
                    className="px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary/50"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Регистрация
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
