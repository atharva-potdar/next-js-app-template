import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // secret used for signing tokens - set in env for production
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  cookies: nextCookies(),
});
