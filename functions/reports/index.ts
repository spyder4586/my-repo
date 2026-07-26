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
import { logger, newRequestId } from './common/logger';
import { ok, toResponse, ApiError } from './common/errors';
import { requireAuth } from './common/auth';
import { canExport, canSeePii } from './common/rbac';
import { config } from './common/config';
import { parse } from './common/validation';
import { z } from 'zod';

/** Templates allowed by the API contract (API_REFERENCE.md "Reports"). */
export const REPORT_TEMPLATES = [
  'DISTRICT_WEEKLY',
  'HOTSPOT_BRIEF',
  'CASE_NETWORK_PACK',
] as const;
export type ReportTemplate = (typeof REPORT_TEMPLATES)[number];

/** ReportJob lifecycle status. */
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETE' | 'FAILED';

export interface ReportJob {
  jobId: string;
  template: ReportTemplate;
  filters: ReportFilters;
  status: JobStatus;
  createdBy: string;
  createdByRole: string;
  piiIncluded: boolean;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  fileSizeBytes?: number;
  errorMessage?: string;
}

export interface ReportFilters {
  districtId?: number;
  unitId?: number;
  caseMasterId?: number;
  dateFrom: string; // ISO date
  dateTo: string; // ISO date
  hops?: number; // CASE_NETWORK_PACK only
}

// In-memory job store (P5-5B stub; replace with Data Store ReportJob table in 5C).
const jobs = new Map<string, ReportJob>();

const reportBodySchema = z.object({
  template: z.enum(REPORT_TEMPLATES),
  filters: z
    .object({
      districtId: z.coerce.number().int().positive().optional(),
      unitId: z.coerce.number().int().positive().optional(),
      caseMasterId: z.coerce.number().int().positive().optional(),
      dateFrom: z.string().date(),
      dateTo: z.string().date(),
      hops: z.coerce.number().int().min(1).max(2).optional(),
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
function enforceScope(
  filters: ReportFilters,
  profile: { role: string; districtId: number | null; unitId: number | null },
  requestId: string,
): ReportFilters {
  const { role, districtId, unitId } = profile;
  if (role === 'SUPER_ADMIN' || role === 'SCRB_ANALYST') {
    return filters; // state-wide
  }
  if (role === 'DISTRICT_COMMAND') {
    if (districtId == null) {
      throw new ApiError('FORBIDDEN_SCOPE', 'District profile not set.', requestId);
    }
    if (filters.districtId != null && filters.districtId !== districtId) {
      throw new ApiError(
        'FORBIDDEN_SCOPE',
        'Cannot generate report for a district outside your scope.',
        requestId,
      );
    }
    return { ...filters, districtId };
  }
  if (role === 'SHO' || role === 'DATA_OPERATOR') {
    if (unitId == null || districtId == null) {
      throw new ApiError('FORBIDDEN_SCOPE', 'Unit profile not set.', requestId);
    }
    if (filters.unitId != null && filters.unitId !== unitId) {
      throw new ApiError(
        'FORBIDDEN_SCOPE',
        'Cannot generate report for a unit outside your scope.',
        requestId,
      );
    }
    return { ...filters, unitId, districtId };
  }
  throw new ApiError('FORBIDDEN_ROLE', 'Role cannot generate reports.', requestId);
}

/** Enforce MAX_DATE_RANGE_DAYS cap (CONFIGURATION.md). */
function enforceDateCap(filters: ReportFilters, requestId: string): ReportFilters {
  const max = config().maxDateRangeDays;
  const from = new Date(filters.dateFrom);
  const to = new Date(filters.dateTo);
  const diffDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
  if (diffDays > max) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Date range exceeds MAX_DATE_RANGE_DAYS (${max}).`,
      requestId,
    );
  }
  return filters;
}

/** Template-specific filter validation. */
function validateTemplateFilters(
  template: ReportTemplate,
  filters: ReportFilters,
  requestId: string,
): void {
  if (template === 'CASE_NETWORK_PACK' && filters.caseMasterId == null) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'CASE_NETWORK_PACK requires filters.caseMasterId.',
      requestId,
    );
  }
  if (template === 'DISTRICT_WEEKLY' && filters.districtId == null) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'DISTRICT_WEEKLY requires filters.districtId.',
      requestId,
    );
  }
  if (template === 'HOTSPOT_BRIEF' && filters.districtId == null && filters.unitId == null) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'HOTSPOT_BRIEF requires filters.districtId or filters.unitId.',
      requestId,
    );
  }
  if (filters.hops != null && filters.hops > config().graphMaxHops) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `hops exceeds GRAPH_MAX_HOPS (${config().graphMaxHops}).`,
      requestId,
    );
  }
}

/**
 * Main handler. Dispatches by method + path.
 * ctx shape (Catalyst Advanced I/O): { method, path, params, query, body, ... }
 */
export default async function reports(ctx: {
  method?: string;
  path?: string;
  params?: Record<string, string>;
  body?: unknown;
}) {
  const requestId = newRequestId();
  try {
    const { profile } = await requireAuth(ctx, requestId);

    // Gate 1: export permission (EXPORT_ROLES).
    if (!canExport(profile.role, config().exportRoles)) {
      throw new ApiError(
        'FORBIDDEN_ROLE',
        `Role ${profile.role} is not authorized to generate reports.`,
        requestId,
      );
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

    throw new ApiError('NOT_FOUND', `Unknown reports route: ${method} ${path}`, requestId);
  } catch (err) {
    const { status, body } = toResponse(err, requestId);
    return { status, body };
  }
}

/** POST /reports — queue a SmartBrowz PDF generation job. */
async function createJob(
  ctx: { body?: unknown },
  profile: { catalystUserId: string; role: string; districtId: number | null; unitId: number | null },
  requestId: string,
) {
  const parsed = parse(reportBodySchema, ctx.body ?? {});
  let filters = parsed.filters as ReportFilters;

  // Server-side scope enforcement (5B DoD: SHO cannot generate another district's report).
  filters = enforceScope(filters, profile, requestId);
  // Date range cap.
  filters = enforceDateCap(filters, requestId);
  // Template-specific required filters.
  validateTemplateFilters(parsed.template, filters, requestId);

  const jobId = `RPT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const piiIncluded = canSeePii(profile.role as never, config().piiRoles);

  const job: ReportJob = {
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

  logger.info('reports.create', {
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
    logger.error('reports.generate.failed', { requestId, jobId, err: String(err) });
  });

  return ok({ jobId, status: 'QUEUED' as JobStatus });
}

/** GET /reports/{jobId} — status + authorized download URL when COMPLETE. */
function getJob(
  jobId: string,
  profile: { catalystUserId: string; role: string },
  requestId: string,
) {
  const job = jobs.get(jobId);
  if (!job) {
    throw new ApiError('NOT_FOUND', `Report job ${jobId} not found.`, requestId);
  }
  // Users can only see their own jobs (unless state-wide role).
  const isState = profile.role === 'SUPER_ADMIN' || profile.role === 'SCRB_ANALYST';
  if (!isState && job.createdBy !== profile.catalystUserId) {
    // ADR-012: out-of-scope -> 404 (not 403).
    throw new ApiError('NOT_FOUND', `Report job ${jobId} not found.`, requestId);
  }
  logger.info('reports.get', { requestId, route: 'GET /reports/{jobId}', jobId, status: job.status });
  return ok({
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
function listJobs(
  profile: { catalystUserId: string; role: string },
  requestId: string,
) {
  const isState = profile.role === 'SUPER_ADMIN' || profile.role === 'SCRB_ANALYST';
  const list = isState
    ? Array.from(jobs.values())
    : Array.from(jobs.values()).filter((j) => j.createdBy === profile.catalystUserId);
  logger.info('reports.list', { requestId, route: 'GET /reports', count: list.length, role: profile.role });
  return ok(
    list.map((j) => ({
      jobId: j.jobId,
      template: j.template,
      status: j.status,
      createdBy: j.createdBy,
      createdByRole: j.createdByRole,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      fileSizeBytes: j.fileSizeBytes,
    })),
  );
}

/**
 * SmartBrowz + Stratus generation.
 * In production: triggers the `report_generate` Circuit (CATALYST_INTEGRATION.md #9):
 *   load_data -> SmartBrowz render PDF -> Stratus reports/ -> update ReportJob -> Mail.
 */
import { catalyst } from './common/datastore';

async function runGeneration(jobId: string, ctx: any): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = 'PROCESSING';
  
  try {
    const app = catalyst(ctx) as any;
    const smartbrowz = app.smartbrowz();
    const filestore = app.filestore();
    
    // SmartBrowz PDF generation.
    // STRATUS_TEMPLATE_BASE_URL must be set to the Catalyst Slate URL
    // (e.g. https://ksp-XXXXXX.development.catalystserverless.com/app/reports/template)
    // after deploying. If not set, falls back to HTML inline template mode.
    const templateBaseUrl = process.env.STRATUS_TEMPLATE_BASE_URL;
    let pdfBuffer: Buffer;
    if (templateBaseUrl) {
      pdfBuffer = await smartbrowz.generatePdf({
        type: 'url',
        url: `${templateBaseUrl}/${job.template}?jobId=${jobId}&dateFrom=${job.filters.dateFrom}&dateTo=${job.filters.dateTo}`,
      });
    } else {
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
    logger.info('reports.generate.complete', { jobId, template: job.template, fileId: uploadResult.id });
  } catch (err) {
    job.status = 'FAILED';
    job.errorMessage = err instanceof Error ? err.message : String(err);
    job.completedAt = new Date().toISOString();
    logger.error('reports.generate.failed', { jobId, err: String(err) });
  }
}

module.exports = reports;
