import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../prisma/prisma.ts', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    strategy: {
      upsert: vi.fn(),
    },
  },
}));

import prisma from '../../../prisma/prisma.ts';
import { ProfileService } from '../profile.service.ts';
import type { BUDGETING_STRATEGY } from '@prisma/client';
import { CURRENCY } from '../../../utils/types.ts';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProfileService();
  });

  describe('getProfile', () => {
    it('queries the user including the strategy relation', async () => {
      const fakeUser = {
        id: 'user-1',
        email: 'foo@test.com',
        preferredCurrency: 'USD',
        encryptionKey: 'key',
        requiredActions: [],
        strategy: { strategy: 'FIFTY_THIRTY_TWENTY' },
      };
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        fakeUser,
      );

      const result = await service.getProfile('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { strategy: true },
      });
      expect(result).toBe(fakeUser);
    });

    it('returns null when the user is not found', async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      const result = await service.getProfile('missing');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('updates user fields and upserts the strategy', async () => {
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.strategy.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(
        {},
      );

      await service.updateProfile('user-1', {
        preferredCurrency: CURRENCY.USD,
        requiredActions: ['confirmEmail'],
        strategy: 'FIFTY_THIRTY_TWENTY' as BUDGETING_STRATEGY,
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          preferredCurrency: CURRENCY.USD,
          requiredActions: ['confirmEmail'],
        },
      });
      expect(prisma.strategy.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: { userId: 'user-1', strategy: 'FIFTY_THIRTY_TWENTY' },
        update: { strategy: 'FIFTY_THIRTY_TWENTY' },
      });
    });

    it('does not pass strategy to user.update', async () => {
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.strategy.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(
        {},
      );

      await service.updateProfile('user-1', {
        preferredCurrency: CURRENCY.PLN,
        requiredActions: [],
        strategy: 'EIGHTY_TWENTY' as BUDGETING_STRATEGY,
      });

      const updateCall = (prisma.user.update as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(updateCall.data).not.toHaveProperty('strategy');
    });
  });
});
