"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crimeNoSchema = exports.dateRangeSchema = exports.paginationSchema = void 0;
exports.parse = parse;
/**
 * Request validation helpers (Zod schemas).
 * Reference: TECH_STACK.md #4, API.md, API_REFERENCE.md.
 */
const zod_1 = require("zod");
const errors_1 = require("./errors");
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.dateRangeSchema = zod_1.z
    .object({
    dateFrom: zod_1.z.string().date().optional(),
    dateTo: zod_1.z.string().date().optional(),
})
    .refine((d) => !d.dateFrom || !d.dateTo || d.dateFrom <= d.dateTo, { message: 'dateFrom must be <= dateTo' });
exports.crimeNoSchema = zod_1.z
    .string()
    .regex(/^\d{14,18}$/, 'CrimeNo must be a 14–18 digit string (leading zeros preserved)');
function parse(schema, input) {
    const result = schema.safeParse(input);
    if (!result.success) {
        const msg = result.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
        throw new errors_1.ApiError('VALIDATION_ERROR', msg);
    }
    return result.data;
}
//# sourceMappingURL=validation.js.map