import { z } from 'zod';

// ===========================================================================
// POST /
// ===========================================================================
export const profileSchema = z.object({
  body: z.object({
    currency: z.enum(['USD', 'EUR', 'PLN']).optional(),
    requiredActions: z.array(z.string()).optional(),
    strategy: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});