/**
 * Request validation helpers (Zod schemas).
 * Reference: TECH_STACK.md #4, API.md, API_REFERENCE.md.
 */
import { z } from 'zod';
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const dateRangeSchema: z.ZodEffects<z.ZodObject<{
    dateFrom: z.ZodOptional<z.ZodString>;
    dateTo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
}, {
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
}>, {
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
}, {
    dateFrom?: string | undefined;
    dateTo?: string | undefined;
}>;
export declare const crimeNoSchema: z.ZodString;
export declare function parse<T>(schema: z.ZodSchema<T>, input: unknown): T;
