import { prisma } from "@repo/db";
import crypto from "crypto";

/**
 * Clean all tables in the database using deleteMany to guarantee a fresh state per module/test.
 */
export async function cleanDb() {
  await prisma.$transaction([
    prisma.templateReview.deleteMany({}),
    prisma.userOwnedTemplate.deleteMany({}),
    prisma.response.deleteMany({}),
    prisma.message.deleteMany({}),       
    prisma.formVersion.deleteMany({}),   
    prisma.conversation.deleteMany({}), 
    prisma.form.deleteMany({}),
    prisma.session.deleteMany({}),
    prisma.account.deleteMany({}),
    prisma.verification.deleteMany({}),
    prisma.user.deleteMany({}),
    prisma.template.deleteMany({}),
  ]);
}

/**
 * Seed a basic user for testing.
 */
export async function seedUser(data?: {
  email?: string;
  name?: string;
  username?: string;
  role?: "USER" | "ADMIN" | "SUPER_ADMIN";
  plan?: "FREE" | "PREMIUM" | "BUSINESS";
}) {
  const email = data?.email ?? `test-${crypto.randomUUID()}@example.com`;
  const name = data?.name ?? "Test User";
  const username = data?.username ?? `user_${crypto.randomUUID().replace(/-/g, "").substring(0, 8)}`;
  const role = data?.role ?? "USER";
  const plan = data?.plan ?? "FREE";

  return await prisma.user.create({
    data: {
      email,
      name,
      username,
      role,
      plan,
    },
  });
}
