/**
 * Request validation helpers (Zod schemas).
 * Reference: TECH_STACK.md #4, API.md, API_REFERENCE.md.
 */
import { z } from 'zod';
import { ApiError } from './errors';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z
  .object({
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
  })
  .refine(
    (d) => !d.dateFrom || !d.dateTo || d.dateFrom <= d.dateTo,
    { message: 'dateFrom must be <= dateTo' },
  );

export const crimeNoSchema = z
  .string()
  .regex(/^\d{14,18}$/, 'CrimeNo must be a 14–18 digit string (leading zeros preserved)');

export function parse<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const msg = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ApiError('VALIDATION_ERROR', msg);
  }
  return result.data;
}
