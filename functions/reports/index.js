"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_TEMPLATES = void 0;
exports.default = reports;
/**
 * Reports Function — SmartBrowz PDF generation jobs.
 * Reference: IMPLEMENTATION2.md 5B, API_REFERENCE.md "Reports", CATALYST_INTEGRATION.md #12.
 *
 * Endpoints (Advanced I/O, routed via API Gateway /api/v1/reports*):
 *   POST /reports              -> queue a generation job (returns { jobId, status: QUEUED })
 *   GET  /reports/{jobId}       -> status + downloadUrl when COMPLETE
 *   GET  /reports               -> history list for current user/scope
 *
 * Templates (API_REFERENCE): DISTRICT_WEEKLY | HOTSPOT_BRIEF | CASE_NETWORK_PACK
 *
 * Enforces: requireAuth + canExport (EXPORT_ROLES) + server-side scope on filters.
 * PII inclusion derived server-side from canSeePii (PII_ROLES), never a client toggle.
 * (5B DoD: SCRB generates District Weekly; SHO cannot generate another district's report.)
 */
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
const rbac_1 = require("./common/rbac");
const config_1 = require("./common/config");
const validation_1 = require("./common/validation");
const zod_1 = require("zod");
/** Templates allowed by the API contract (API_REFERENCE.md "Reports"). */
exports.REPORT_TEMPLATES = [
    'DISTRICT_WEEKLY',
    'HOTSPOT_BRIEF',
    'CASE_NETWORK_PACK',
];
// In-memory job store (P5-5B stub; replace with Data Store ReportJob table in 5C).
const jobs = new Map();
const reportBodySchema = zod_1.z.object({
    template: zod_1.z.enum(exports.REPORT_TEMPLATES),
    filters: zod_1.z
        .object({
        districtId: zod_1.z.coerce.number().int().positive().optional(),
        unitId: zod_1.z.coerce.number().int().positive().optional(),
        caseMasterId: zod_1.z.coerce.number().int().positive().optional(),
        dateFrom: zod_1.z.string().date(),
        dateTo: zod_1.z.string().date(),
        hops: zod_1.z.coerce.number().int().min(1).max(2).optional(),
    })
        .refine((f) => f.dateFrom <= f.dateTo, { message: 'dateFrom must be <= dateTo' }),
});
/**
 * Enforce role scope on requested filters (server-side, 5B DoD).
 * - DISTRICT_COMMAND: districtId must equal own district; unitId must be within own district.
 * - SHO/DATA_OPERATOR: unitId must equal own unit; districtId must equal own district.
 * - SCRB/SUPER_ADMIN: state-wide (any district/unit allowed).
 * - IO/VIEWER: cannot export at all (blocked by canExport).
 */
function enforceScope(filters, profile, requestId) {
    const { role, districtId, unitId } = profile;
    if (role === 'SUPER_ADMIN' || role === 'SCRB_ANALYST') {
        return filters; // state-wide
    }
    if (role === 'DISTRICT_COMMAND') {
        if (districtId == null) {
            throw new errors_1.ApiError('FORBIDDEN_SCOPE', 'District profile not set.', requestId);
        }
        if (filters.districtId != null && filters.districtId !== districtId) {
            throw new errors_1.ApiError('FORBIDDEN_SCOPE', 'Cannot generate report for a district outside your scope.', requestId);
        }
        return { ...filters, districtId };
    }
    if (role === 'SHO' || role === 'DATA_OPERATOR') {
        if (unitId == null || districtId == null) {
            throw new errors_1.ApiError('FORBIDDEN_SCOPE', 'Unit profile not set.', requestId);
        }
        if (filters.unitId != null && filters.unitId !== unitId) {
            throw new errors_1.ApiError('FORBIDDEN_SCOPE', 'Cannot generate report for a unit outside your scope.', requestId);
        }
        return { ...filters, unitId, districtId };
    }
    throw new errors_1.ApiError('FORBIDDEN_ROLE', 'Role cannot generate reports.', requestId);
}
/** Enforce MAX_DATE_RANGE_DAYS cap (CONFIGURATION.md). */
function enforceDateCap(filters, requestId) {
    const max = (0, config_1.config)().maxDateRangeDays;
    const from = new Date(filters.dateFrom);
    const to = new Date(filters.dateTo);
    const diffDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
    if (diffDays > max) {
        throw new errors_1.ApiError('VALIDATION_ERROR', `Date range exceeds MAX_DATE_RANGE_DAYS (${max}).`, requestId);
    }
    return filters;
}
/** Template-specific filter validation. */
function validateTemplateFilters(template, filters, requestId) {
    if (template === 'CASE_NETWORK_PACK' && filters.caseMasterId == null) {
        throw new errors_1.ApiError('VALIDATION_ERROR', 'CASE_NETWORK_PACK requires filters.caseMasterId.', requestId);
    }
    if (template === 'DISTRICT_WEEKLY' && filters.districtId == null) {
        throw new errors_1.ApiError('VALIDATION_ERROR', 'DISTRICT_WEEKLY requires filters.districtId.', requestId);
    }
    if (template === 'HOTSPOT_BRIEF' && filters.districtId == null && filters.unitId == null) {
        throw new errors_1.ApiError('VALIDATION_ERROR', 'HOTSPOT_BRIEF requires filters.districtId or filters.unitId.', requestId);
    }
    if (filters.hops != null && filters.hops > (0, config_1.config)().graphMaxHops) {
        throw new errors_1.ApiError('VALIDATION_ERROR', `hops exceeds GRAPH_MAX_HOPS (${(0, config_1.config)().graphMaxHops}).`, requestId);
    }
}
/**
 * Main handler. Dispatches by method + path.
 * ctx shape (Catalyst Advanced I/O): { method, path, params, query, body, ... }
 */
async function reports(ctx) {
    const requestId = (0, logger_1.newRequestId)();
    try {
        const { profile } = await (0, auth_1.requireAuth)(ctx, requestId);
        // Gate 1: export permission (EXPORT_ROLES).
        if (!(0, rbac_1.canExport)(profile.role, (0, config_1.config)().exportRoles)) {
            throw new errors_1.ApiError('FORBIDDEN_ROLE', `Role ${profile.role} is not authorized to generate reports.`, requestId);
        }
        const method = (ctx.method ?? 'GET').toUpperCase();
        const path = ctx.path ?? '';
        // Normalize profile (districtId/unitId may be undefined -> null).
        const p = {
            catalystUserId: profile.catalystUserId,
            role: profile.role,
            districtId: profile.districtId ?? null,
            unitId: profile.unitId ?? null,
        };
        // POST /reports -> create job
        if (method === 'POST' && (path === '' || path === '/')) {
            return createJob(ctx, p, requestId);
        }
        // GET /reports/{jobId} -> job status + downloadUrl
        if (method === 'GET' && ctx.params?.jobId) {
            return getJob(ctx.params.jobId, p, requestId);
        }
        // GET /reports -> history list for current user/scope
        if (method === 'GET') {
            return listJobs(p, requestId);
        }
        throw new errors_1.ApiError('NOT_FOUND', `Unknown reports route: ${method} ${path}`, requestId);
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        return { status, body };
    }
}
/** POST /reports — queue a SmartBrowz PDF generation job. */
async function createJob(ctx, profile, requestId) {
    const parsed = (0, validation_1.parse)(reportBodySchema, ctx.body ?? {});
    let filters = parsed.filters;
    // Server-side scope enforcement (5B DoD: SHO cannot generate another district's report).
    filters = enforceScope(filters, profile, requestId);
    // Date range cap.
    filters = enforceDateCap(filters, requestId);
    // Template-specific required filters.
    validateTemplateFilters(parsed.template, filters, requestId);
    const jobId = `RPT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
    const piiIncluded = (0, rbac_1.canSeePii)(profile.role, (0, config_1.config)().piiRoles);
    const job = {
        jobId,
        template: parsed.template,
        filters,
        status: 'QUEUED',
        createdBy: profile.catalystUserId,
        createdByRole: profile.role,
        piiIncluded,
        createdAt: new Date().toISOString(),
    };
    jobs.set(jobId, job);
    logger_1.logger.info('reports.create', {
        requestId,
        route: 'POST /reports',
        jobId,
        template: parsed.template,
        role: profile.role,
        piiIncluded,
    });
    // Kick off async generation (SmartBrowz + Stratus)
    void runGeneration(jobId, ctx).catch((err) => {
        const failed = jobs.get(jobId);
        if (failed) {
            failed.status = 'FAILED';
            failed.errorMessage = err instanceof Error ? err.message : 'Generation failed.';
            failed.completedAt = new Date().toISOString();
        }
        logger_1.logger.error('reports.generate.failed', { requestId, jobId, err: String(err) });
    });
    return (0, errors_1.ok)({ jobId, status: 'QUEUED' });
}
/** GET /reports/{jobId} — status + authorized download URL when COMPLETE. */
function getJob(jobId, profile, requestId) {
    const job = jobs.get(jobId);
    if (!job) {
        throw new errors_1.ApiError('NOT_FOUND', `Report job ${jobId} not found.`, requestId);
    }
    // Users can only see their own jobs (unless state-wide role).
    const isState = profile.role === 'SUPER_ADMIN' || profile.role === 'SCRB_ANALYST';
    if (!isState && job.createdBy !== profile.catalystUserId) {
        // ADR-012: out-of-scope -> 404 (not 403).
        throw new errors_1.ApiError('NOT_FOUND', `Report job ${jobId} not found.`, requestId);
    }
    logger_1.logger.info('reports.get', { requestId, route: 'GET /reports/{jobId}', jobId, status: job.status });
    return (0, errors_1.ok)({
        jobId: job.jobId,
        template: job.template,
        status: job.status,
        downloadUrl: job.downloadUrl,
        fileSizeBytes: job.fileSizeBytes,
        piiIncluded: job.piiIncluded,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage,
    });
}
/** GET /reports — history list for current user (state roles see all). */
function listJobs(profile, requestId) {
    const isState = profile.role === 'SUPER_ADMIN' || profile.role === 'SCRB_ANALYST';
    const list = isState
        ? Array.from(jobs.values())
        : Array.from(jobs.values()).filter((j) => j.createdBy === profile.catalystUserId);
    logger_1.logger.info('reports.list', { requestId, route: 'GET /reports', count: list.length, role: profile.role });
    return (0, errors_1.ok)(list.map((j) => ({
        jobId: j.jobId,
        template: j.template,
        status: j.status,
        createdBy: j.createdBy,
        createdByRole: j.createdByRole,
        createdAt: j.createdAt,
        completedAt: j.completedAt,
        fileSizeBytes: j.fileSizeBytes,
    })));
}
/**
 * SmartBrowz + Stratus generation.
 * In production: triggers the `report_generate` Circuit (CATALYST_INTEGRATION.md #9):
 *   load_data -> SmartBrowz render PDF -> Stratus reports/ -> update ReportJob -> Mail.
 */
const datastore_1 = require("./common/datastore");
async function runGeneration(jobId, ctx) {
    const job = jobs.get(jobId);
    if (!job)
        return;
    job.status = 'PROCESSING';
    try {
        const app = (0, datastore_1.catalyst)(ctx);
        const smartbrowz = app.smartbrowz();
        const filestore = app.filestore();
        // SmartBrowz PDF generation.
        // STRATUS_TEMPLATE_BASE_URL must be set to the Catalyst Slate URL
        // (e.g. https://ksp-XXXXXX.development.catalystserverless.com/app/reports/template)
        // after deploying. If not set, falls back to HTML inline template mode.
        const templateBaseUrl = process.env.STRATUS_TEMPLATE_BASE_URL;
        let pdfBuffer;
        if (templateBaseUrl) {
            pdfBuffer = await smartbrowz.generatePdf({
                type: 'url',
                url: `${templateBaseUrl}/${job.template}?jobId=${jobId}&dateFrom=${job.filters.dateFrom}&dateTo=${job.filters.dateTo}`,
            });
        }
        else {
            // Fallback: generate a minimal HTML report when template URL is not yet configured.
            // Replace this with a full HTML template or the Slate URL once deployed.
            const htmlContent = `<!DOCTYPE html><html><head><title>${job.template} Report</title></head><body>
        <h1>KSP Intelligence Report: ${job.template}</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        <p>Date Range: ${job.filters.dateFrom} to ${job.filters.dateTo}</p>
        <p>District: ${job.filters.districtId ?? 'State-wide'}</p>
        <p><em>Configure STRATUS_TEMPLATE_BASE_URL env var to use the full template renderer.</em></p>
      </body></html>`;
            pdfBuffer = await smartbrowz.generatePdf({
                type: 'html',
                html: htmlContent,
            });
        }
        // 2. Upload to Stratus (Filestore)
        // Fallback to folder 1000 if not configured
        const folderId = Number(process.env.STRATUS_REPORTS_FOLDER_ID) || 1000;
        const folder = filestore.folder(folderId);
        const uploadResult = await folder.uploadFile({
            code: pdfBuffer,
            name: `${jobId}.pdf`
        });
        job.status = 'COMPLETE';
        job.completedAt = new Date().toISOString();
        job.downloadUrl = `/api/v1/reports/${jobId}/download`;
        job.fileSizeBytes = uploadResult.size || pdfBuffer.length;
        logger_1.logger.info('reports.generate.complete', { jobId, template: job.template, fileId: uploadResult.id });
    }
    catch (err) {
        job.status = 'FAILED';
        job.errorMessage = err instanceof Error ? err.message : String(err);
        job.completedAt = new Date().toISOString();
        logger_1.logger.error('reports.generate.failed', { jobId, err: String(err) });
    }
}
module.exports = reports;
//# sourceMappingURL=index.js.map