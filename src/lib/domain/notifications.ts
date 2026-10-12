import { prisma, type NotificationKind, type Prisma } from "../prisma";

/**
 * Мэдэгдлийн модуль (FR-28).
 *
 * Төлөв өөрчлөгдөх, хариу ирэх, босго давах, хугацаа дуусахад ойртох үед
 * холбогдох хэрэглэгчдэд мэдэгдэнэ. Одоогоор системийн доторх мэдэгдлийг
 * хадгалж, и-мэйлээр илгээх ажлыг `emailedAt` талбараар мөшгинө — и-мэйл
 * илгээгч нь SMTP тохируулагдсан үед ажиллана.
 */

export type NotifyInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
};

/** Нэг хэрэглэгчид мэдэгдэнэ. Транзакц дотроос дуудаж болно. */
export async function notify(
  input: NotifyInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? "",
      href: input.href ?? "",
    },
  });
}

/** Олон хэрэглэгчид нэг мэдэгдэл илгээнэ (жишээ нь бүх дэмжигчид). */
export async function notifyMany(
  userIds: readonly string[],
  input: Omit<NotifyInput, "userId">,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return { count: 0 };
  return tx.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? "",
      href: input.href ?? "",
    })),
  });
}

/** Тодорхой эрхтэй бүх хэрэглэгчид мэдэгдэнэ (модератор, админ). */
export async function notifyRole(
  role: "MODERATOR" | "ADMIN",
  input: Omit<NotifyInput, "userId">,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const users = await tx.user.findMany({
    where: { role, active: true },
    select: { id: true },
  });
  return notifyMany(
    users.map((u) => u.id),
    input,
    tx
  );
}

/** Тухайн нэгжийн бүх ажилтанд мэдэгдэнэ. */
export async function notifyUnit(
  unitId: string,
  input: Omit<NotifyInput, "userId">,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const users = await tx.user.findMany({
    where: { unitId, role: "UNIT_STAFF", active: true },
    select: { id: true },
  });
  return notifyMany(
    users.map((u) => u.id),
    input,
    tx
  );
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string, take = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
