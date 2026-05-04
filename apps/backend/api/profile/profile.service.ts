import type { BUDGETING_STRATEGY } from '@prisma/client';
import prisma from '../../prisma/prisma.ts';
import type { CURRENCY } from '../../utils/types.ts';
import { singleton } from 'tsyringe';

@singleton()
export class ProfileService {
  constructor() {}

  async getProfile(userId: string) {
    return prisma.user.findUnique({
      where: {
        id: userId,
      },

      include: { strategy: true },
    });
  }

  async updateProfile(
    userId: string,
    {
      preferredCurrency,
      requiredActions,
      strategy,
    }: {
      preferredCurrency: CURRENCY;
      requiredActions: string[];
      strategy: BUDGETING_STRATEGY;
    },
  ) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        preferredCurrency,
        requiredActions,
      },
    });

    await prisma.strategy.upsert({
      where: { userId },
      create: {
        userId,
        strategy,
      },
      update: {
        strategy,
      },
    });
  }

}