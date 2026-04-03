"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";

export async function markNotificationReadAction(notificationId: string) {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId: user.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  redirect("/notifications");
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  redirect("/notifications");
}
