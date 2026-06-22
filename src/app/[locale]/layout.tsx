import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { Navbar } from "@/components/Navbar";
import { auth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/notifications";
import { SessionProvider } from "@/components/SessionProvider";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "fr")) {
    notFound();
  }

  const messages = await getMessages();
  const session = await auth();
  let unreadCount = 0;
  if (session?.user?.id) {
    try {
      unreadCount = await getUnreadCount(session.user.id);
    } catch (error) {
      console.error("[layout] getUnreadCount failed:", error);
    }
  }

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider session={session}>
          <NextIntlClientProvider messages={messages}>
            <Navbar
              user={session?.user ?? null}
              unreadCount={unreadCount}
            />
            <main className="flex-1">{children}</main>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
