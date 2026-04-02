import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function upsertUser({
  username,
  displayName,
  password,
  role,
}: {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
}) {
  const normalizedUsername = username.trim().toLowerCase();
  const credentials = await hashPassword(password);

  return prisma.user.upsert({
    where: { username: normalizedUsername },
    update: {
      displayName,
      role,
      isActive: true,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
    },
    create: {
      username: normalizedUsername,
      displayName,
      role,
      isActive: true,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
    },
  });
}

async function main() {
  await upsertUser({
    username: process.env.ADMIN_USERNAME ?? "admin",
    displayName: process.env.ADMIN_DISPLAY_NAME ?? "System Administrator",
    password: requireEnv("ADMIN_PASSWORD"),
    role: UserRole.ADMIN,
  });

  await upsertUser({
    username: process.env.METER_READER_USERNAME ?? "meter.reader",
    displayName: process.env.METER_READER_DISPLAY_NAME ?? "Utility Reader",
    password: requireEnv("METER_READER_PASSWORD"),
    role: UserRole.METER_READER,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
