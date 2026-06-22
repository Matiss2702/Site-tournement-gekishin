import { NotificationType } from "@/generated/prisma/client";
import { prisma, withPrismaRetry } from "./prisma";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  titleEn: string;
  titleFr: string;
  messageEn: string;
  messageFr: string;
  link?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({ data: params });
}

export async function getUnreadCount(userId: string) {
  return withPrismaRetry(() =>
    prisma.notification.count({
      where: { userId, read: false },
    })
  );
}

export async function markAsRead(notificationId: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
