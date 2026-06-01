import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

try {
  const before = await prisma.payment.findMany({
    orderBy: [{ createdAt: "asc" }],
    take: 5,
    select: {
      id: true,
      paymentDate: true,
      invoice: {
        select: {
          invoiceNumber: true,
          issueDate: true,
        },
      },
    },
  });

  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "Payment" AS p
    SET "paymentDate" = i."issueDate" + INTERVAL '1 day'
    FROM "Invoice" AS i
    WHERE p."invoiceId" = i.id
  `);

  const after = await prisma.payment.findMany({
    orderBy: [{ createdAt: "asc" }],
    take: 5,
    select: {
      id: true,
      paymentDate: true,
      invoice: {
        select: {
          invoiceNumber: true,
          issueDate: true,
        },
      },
    },
  });

  console.log(JSON.stringify({ updated, before, after }, null, 2));
} finally {
  await prisma.$disconnect();
}
