"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";

interface Notification {
  id: string;
  type: string;
  titleEn: string;
  titleFr: string;
  messageEn: string;
  messageFr: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      });
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markAllRead" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">
          {t("title")}
          {unreadCount > 0 && (
            <span className="text-sm text-muted ml-2">
              ({unreadCount} {t("unread")})
            </span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn btn-secondary text-sm">
            {t("markAllRead")}
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-muted text-center py-12">{t("noNotifications")}</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`card py-3 ${!notif.read ? "border-primary/50" : ""}`}
              onClick={() => !notif.read && markRead(notif.id)}
            >
              <h3 className="font-medium">
                {locale === "fr" ? notif.titleFr : notif.titleEn}
              </h3>
              <p className="text-sm text-muted mt-1">
                {locale === "fr" ? notif.messageFr : notif.messageEn}
              </p>
              {notif.link && (
                <Link
                  href={notif.link}
                  className="text-primary text-sm mt-2 inline-block hover:underline"
                >
                  View →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
