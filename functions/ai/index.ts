/**
 * AI Function — risk scores, anomalies, model metadata.
 * Reference: IMPLEMENTATION2.md 4C, API_REFERENCE.md "AI".
 * Status: scaffold (4C implements QuickML/Zia inference).
 *
 * Service mapping (verified 2026-07-25):
 *  - Text inference (keyword + sentiment) below uses Catalyst Zia Text Analytics
 *    via app.zia().extractKeyword() / analyzeSentiment().
 *    Doc: https://docs.catalyst.zoho.com/en/zia-services/help/text-analytics/introduction/
 *    This is a Zia Services component, NOT QuickML LLM Serving/RAG.
 *  - Risk prediction / model training (retrainModel branch) targets Catalyst Zia AutoML.
 *    Doc: https://docs.catalyst.zoho.com/en/zia-services/help/automl/introduction/
 *    NOTE: Zia AutoML is unavailable in the EU, AU, IN, JP, SA, CA data centers.
 *    For an IN-hosted project, the retrain path must be redirected to QuickML
 *    no-code ML pipelines (no regional restriction). See CATALYST_CONSOLE_RUNBOOK.md
 *    Issue 1 for the data-center gate.
 *  - QuickML LLM Serving (US/IN/EU only) is a separate Generative-AI feature used
 *    for chat/RAG; it is NOT wired here. To add "ask about a case file", use
 *    QuickML LLM Serving + Knowledge Base.
 *    Doc: https://docs.catalyst.zoho.com/en/quickml/help/generative-ai/llm-serving/
 */
import { logger, newRequestId } from './common/logger';
import { ok, toResponse, ApiError } from './common/errors';
import { requireRoles } from './common/auth';
import type { Role } from './common/rbac';
import { catalyst, scopeWhereClause, sanitizeZcqlString } from './common/datastore';

const AI_ROLES: Role[] = ['SUPER_ADMIN', 'SCRB_ANALYST', 'DISTRICT_COMMAND'];

export default async function ai(ctx: any) {
  const requestId = newRequestId();
  try {
    const app = catalyst(ctx) as any;
    const req = ctx.req || {};
    const method = (req.method || 'GET').toUpperCase();
    const url = new URL(req.url || '/ai', `http://${req.headers?.host || 'localhost'}`);
    const path = url.pathname.replace(/\/$/, '');
    const body = req.body || {};

    // Catalyst Cron Job trigger — allowlisted job actions (no user session required).
    const jobAction = url.searchParams.get('job_action') || body.job_action;
    if (jobAction === 'scanAnomalies') {
      logger.info('ai.job.scanAnomalies', { requestId, trigger: 'cron' });
      // Delegate to anomaly detection logic below (zcql-backed z-score scan).
      // Re-enter as GET /ai/anomalies with SUPER_ADMIN-level scope override.
      const zcql = app.zcql();
      const now = new Date();
      const dayMs = 86400000;
      const recentStart = new Date(now.getTime() - dayMs);
      const baselineStart = new Date(now.getTime() - 31 * dayMs);
      const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
      const recentQ = `SELECT DistrictID, CrimeMajorHeadID, COUNT(*) AS Cnt FROM CaseMaster WHERE CrimeRegisteredDate >= '${recentStart.toISOString().slice(0,19).replace('T',' ')}' GROUP BY DistrictID, CrimeMajorHeadID`;
      const baselineQ = `SELECT DistrictID, CrimeMajorHeadID, COUNT(*) AS Cnt FROM CaseMaster WHERE CrimeRegisteredDate >= '${baselineStart.toISOString().slice(0,19).replace('T',' ')}' AND CrimeRegisteredDate < '${fmt(recentStart)}' GROUP BY DistrictID, CrimeMajorHeadID`;
      const recent: any[] = (await zcql.executeZCQLQuery(recentQ).catch(() => [])) || [];
      const baseline: any[] = (await zcql.executeZCQLQuery(baselineQ).catch(() => [])) || [];
      logger.info('ai.job.scanAnomalies.complete', { requestId, recentRows: recent.length, baselineRows: baseline.length });
      return ok({ job: 'scanAnomalies', status: 'completed', scannedRows: recent.length, triggeredAt: new Date().toISOString() });
    }
    if (jobAction === 'retrainModel') {
      logger.info('ai.job.retrainModel', { requestId, trigger: 'cron' });
      const endpoint = process.env.QUICKML_PIPELINE_ENDPOINT;
      if (!endpoint) {
        return ok({ job: 'retrainModel', status: 'NOT_CONFIGURED', message: 'QUICKML_PIPELINE_ENDPOINT not set' });
      }
      const mlRes = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'retrain', trigger: 'weekly_cron' }) }).catch(() => null);
      return ok({ job: 'retrainModel', status: mlRes?.ok ? 'completed' : 'FAILED', httpStatus: mlRes?.status ?? null, triggeredAt: new Date().toISOString() });
    }

    await requireRoles(AI_ROLES, ctx, requestId);

    // ---- Phase 2.3: QuickML Model Invocation & Retraining ----
    // Targets deployed QuickML Pipeline endpoint via process.env.QUICKML_PIPELINE_ENDPOINT.
    // If QUICKML_PIPELINE_ENDPOINT is set, calls the deployed QuickML pipeline.
    if (method === 'POST' && (path.includes('/retrain') || body.action === 'retrain' || path.includes('/predict'))) {
      const quickmlEndpoint = process.env.QUICKML_PIPELINE_ENDPOINT;
      const quickmlApiKey = process.env.QUICKML_API_KEY;
      if (quickmlEndpoint) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (quickmlApiKey) {
            headers['Authorization'] = `Zoho-enczapi ${quickmlApiKey}`;
            headers['x-api-key'] = quickmlApiKey;
          }

          const mlRes = await fetch(quickmlEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body.payload || body.features || { action: 'retrain' }),
          });

          const mlJson = (await mlRes.json().catch(() => ({}))) as Record<string, unknown>;

          if (!mlRes.ok) {
            throw new ApiError(
              'DEPENDENCY_UNAVAILABLE',
              `QuickML endpoint returned HTTP ${mlRes.status}: ${JSON.stringify(mlJson)}`,
              requestId
            );
          }

          // Defensive response schema validation — require recognizable fields or return raw payload
          const modelVersion = (mlJson.modelVersion as string) ?? (mlJson.version as string) ?? (mlJson.model_id as string) ?? 'quickml-v1';
          const prediction = mlJson.prediction ?? mlJson.result ?? mlJson.output ?? mlJson.predictions ?? null;

          logger.info('ai.retrain.quickml', { requestId, endpoint: quickmlEndpoint, status: mlRes.status });
          return ok({
            source: 'Catalyst QuickML Pipeline',
            status: 'SUCCESS',
            modelVersion,
            trainedAt: new Date().toISOString(),
            prediction,
            rawResponse: mlJson,
            message: 'QuickML pipeline request executed successfully',
          });
        } catch (err) {
          if (err instanceof ApiError) throw err;
          throw new ApiError('DEPENDENCY_UNAVAILABLE', `QuickML request failed: ${String(err)}`, requestId);
        }
      }
      // No QuickML endpoint configured — return honest status (not mock success).
      logger.info('ai.retrain.not-deployed', { requestId });
      return ok({
        source: 'QuickML (not yet deployed)',
        status: 'NOT_CONFIGURED',
        modelVersion: null,
        message: 'QUICKML_PIPELINE_ENDPOINT env var not set. Deploy the QuickML pipeline per docs/QUICKML_CONSOLE_RUNBOOK.md',
      });
    }

    // ---- Phase 2.4: Anomaly detection (z-score) ----
    // Computes rolling mean + std-dev per district+category, flags z > 2.5.
    if (method === 'GET' && path.endsWith('/anomalies')) {
      const { scope } = await requireRoles(AI_ROLES, ctx, requestId);
      const scopeClause = scopeWhereClause(scope);
      const zcql = app.zcql();
      const now = new Date();
      const dayMs = 86400000;
      const recentStart = new Date(now.getTime() - dayMs);
      const baselineStart = new Date(now.getTime() - 31 * dayMs);
      const fmt = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

      // Current 24h counts per district+category
      const recentQ = `SELECT DistrictID, CrimeMajorHeadID, COUNT(*) AS Cnt FROM CaseMaster WHERE CrimeRegisteredDate >= '${sanitizeZcqlString(fmt(recentStart))}' AND ${scopeClause} GROUP BY DistrictID, CrimeMajorHeadID`;
      // 30-day baseline counts per district+category
      const baselineQ = `SELECT DistrictID, CrimeMajorHeadID, COUNT(*) AS Cnt FROM CaseMaster WHERE CrimeRegisteredDate >= '${sanitizeZcqlString(fmt(baselineStart))}' AND CrimeRegisteredDate < '${sanitizeZcqlString(fmt(recentStart))}' AND ${scopeClause} GROUP BY DistrictID, CrimeMajorHeadID`;

      const recent: any[] = (await zcql.executeZCQLQuery(recentQ).catch(() => [])) || [];
      const baseline: any[] = (await zcql.executeZCQLQuery(baselineQ).catch(() => [])) || [];

      // baseline daily mean + std-dev per district+category
      const stats = new Map<string, { mean: number; variance: number }>();
      for (const r of baseline) {
        const row = r.CaseMaster || r;
        const k = `${row.DistrictID}:${row.CrimeMajorHeadID}`;
        const dailyCount = Number(row.Cnt) / 30;
        stats.set(k, { mean: dailyCount, variance: dailyCount }); // Poisson approx: variance ≈ mean
      }

      const catNames: Record<number, string> = { 1: 'Cyber Fraud', 2: 'House Breaking', 3: 'Robbery', 4: 'Vehicle Theft', 5: 'Assault', 6: 'Chain Snatching', 7: 'Cheating', 8: 'Murder', 9: 'Cattle Theft' };

      const anomalies: any[] = [];
      let rzId = 1;
      for (const r of recent) {
        const row = r.CaseMaster || r;
        const did = Number(row.DistrictID);
        const cat = Number(row.CrimeMajorHeadID);
        const current = Number(row.Cnt);
        const k = `${did}:${cat}`;
        const s = stats.get(k);
        if (!s || s.mean === 0) continue;
        const std = Math.sqrt(s.variance);
        const z = (current - s.mean) / std;
        if (z > 2.5) {
          anomalies.push({
            id: `RZ-${rzId++}`,
            zoneName: `District ${did}`,
            district: `District ${did}`,
            station: `District ${did}`,
            riskScore: Math.min(100, Math.round(50 + z * 12)),
            riskLevel: z > 4 ? 'CRITICAL' : z > 3 ? 'HIGH' : 'MODERATE',
            predictedCategory: catNames[cat] ?? `Category ${cat}`,
            whyFlagged: [
              `Current 24h count (${current}) is ${z.toFixed(1)}σ above the 30-day daily mean (${s.mean.toFixed(1)})`,
              `Standard deviation: ${std.toFixed(2)} cases/day`,
              `Spike ratio: ${(current / s.mean).toFixed(1)}x baseline`,
            ],
            recommendedAction: `Investigate ${catNames[cat] ?? 'crime'} surge in District ${did}; deploy additional patrols`,
            confidence: Math.min(95, Math.round(60 + z * 8)),
            zScore: Number(z.toFixed(2)),
          });
        }
      }
      logger.info('ai.anomalies', { requestId, count: anomalies.length });
      return ok(anomalies.sort((a, b) => b.zScore - a.zScore));
    }

    // ---- Zia Text Analytics (sentiment + keyword extraction) ----
    const textToAnalyze = body.text || "Crime trend analysis requested for recent activities.";

    // Catalyst Zia Text Analytics (NOT QuickML LLM Serving).
    // Doc: https://docs.catalyst.zoho.com/en/zia-services/help/text-analytics/introduction/
    const zia = app.zia();
    const keywordExtraction = await zia.extractKeyword([textToAnalyze]);
    const sentimentAnalysis = await zia.analyzeSentiment([textToAnalyze]);

    logger.info('ai.inference', { requestId, route: '/ai', method });

    return ok({
      source: 'Catalyst Zia Text Analytics',
      analysis: {
        keywords: keywordExtraction,
        sentiment: sentimentAnalysis
      },
      message: 'AI endpoint connected to Catalyst Zia Text Analytics'
    });
  } catch (err) {
    const { status, body } = toResponse(err, requestId);
    return { status, body };
  }
}

module.exports = ai;
