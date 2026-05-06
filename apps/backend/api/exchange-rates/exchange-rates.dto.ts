import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// ===========================================================================
// GET /range/:fromDate/:toDate
// ===========================================================================
export const getAggregatedRatesSchema = z.object({
  params: z.object({
    fromDate: isoDate,
    toDate: isoDate,
  }),
});
