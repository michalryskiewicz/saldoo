import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import prisma from './prisma/prisma.ts';
import { createAuthMiddleware } from 'better-auth/api';

export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      ctx.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    }),
  },
  trustedOrigins: [`${process.env.FRONTEND_URL}`],
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
});
