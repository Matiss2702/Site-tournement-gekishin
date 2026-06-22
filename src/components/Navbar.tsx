"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { signOut, useSession } from "next-auth/react";
import { useLocale } from "next-intl";

interface NavbarProps {
  user?: {
    username: string;
    id: string;
  } | null;
  unreadCount?: number;
}

export function Navbar({ user: serverUser, unreadCount = 0 }: NavbarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const locale = useLocale();
  const { data: session, status } = useSession();

  const user =
    status === "authenticated"
      ? session?.user ?? null
      : status === "loading"
        ? serverUser ?? null
        : null;

  const links = [
    { href: "/tournaments", label: t("tournaments") },
    { href: "/teams", label: t("teams") },
    ...(user ? [{ href: "/dashboard", label: t("dashboard") }] : []),
  ];

  const toggleLocale = locale === "en" ? "fr" : "en";

  return (
    <header className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold text-primary">
              Gekishin
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    pathname.startsWith(link.href)
                      ? "text-primary"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href={pathname}
              locale={toggleLocale}
              className="text-sm text-muted hover:text-foreground uppercase font-medium"
              title={toggleLocale === "fr" ? t("switchToFrench") : t("switchToEnglish")}
            >
              {locale.toUpperCase()}
            </Link>

            {user ? (
              <>
                <Link
                  href="/notifications"
                  className="relative text-muted hover:text-foreground"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-danger text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
                <Link href="/dashboard" className="text-sm font-medium">
                  {user.username}
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: `/${locale}` })}
                  className="btn btn-secondary text-sm py-2 px-3"
                >
                  {t("logout")}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-secondary text-sm py-2 px-3">
                  {t("login")}
                </Link>
                <Link href="/register" className="btn btn-primary text-sm py-2 px-3">
                  {t("register")}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
