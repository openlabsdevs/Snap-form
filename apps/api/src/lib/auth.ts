import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";
import { config } from "./env";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: config.auth.secret,
  baseURL: config.auth.url,
  trustedOrigins: config.trustedOrigins,

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    google: {
      clientId: config.oauth.googleClientId,
      clientSecret: config.oauth.googleClientSecret,
    },
    github: {
      clientId: config.oauth.githubClientId,
      clientSecret: config.oauth.githubClientSecret,
    },
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        defaultValue: null,
      },
    },
  },
});
