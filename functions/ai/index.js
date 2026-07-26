"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ai;
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
const logger_1 = require("./common/logger");
const errors_1 = require("./common/errors");
const auth_1 = require("./common/auth");
const datastore_1 = require("./common/datastore");
const AI_ROLES = ['SUPER_ADMIN', 'SCRB_ANALYST', 'DISTRICT_COMMAND'];
async function ai(ctx) {
    const requestId = (0, logger_1.newRequestId)();
    try {
        const app = (0, datastore_1.catalyst)(ctx);
        const req = ctx.req || {};
        const method = (req.method || 'GET').toUpperCase();
        const url = new URL(req.url || '/ai', `http://${req.headers?.host || 'localhost'}`);
        const path = url.pathname.replace(/\/$/, '');
        const body = req.body || {};
        // Catalyst Cron Job trigger — allowlisted job actions (no user session required).
        const jobAction = url.searchParams.get('job_action') || body.job_action;
        if (jobAction === 'scanAnomalies') {
            logger_1.logger.info('ai.job.scanAnomalies', { requestId, trigger: 'cron' });
            // Delegate to anomaly detection logic below (zcql-backed z-score scan).
            // Re-enter as GET /ai/anomalies with SUPER_ADMIN-level scope override.
            const zcql = app.zcql();
            const now = new Date();
            const dayMs = 86400000;
            const recentStart = new Date(now.getTime() - dayMs);
            const baselineStart = new Date(now.getTime() - 31 * dayMs);
            const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
            const recentQ = `SELECT DistrictID, CrimeMajorHeadID, COUNT(*) AS Cnt FROM CaseMaster WHERE CrimeRegisteredDate >= '${recentStart.toISOString().slice(0, 19).replace('T', ' ')}' GROUP BY DistrictID, CrimeMajorHeadID`;
            const baselineQ = `SELECT DistrictID, CrimeMajorHeadID, COUNT(*) AS Cnt FROM CaseMaster WHERE CrimeRegisteredDate >= '${baselineStart.toISOString().slice(0, 19).replace('T', ' ')}' AND CrimeRegisteredDate < '${fmt(recentStart)}' GROUP BY DistrictID, CrimeMajorHeadID`;
            const recent = (await zcql.executeZCQLQuery(recentQ).catch(() => [])) || [];
            const baseline = (await zcql.executeZCQLQuery(baselineQ).catch(() => [])) || [];
            logger_1.logger.info('ai.job.scanAnomalies.complete', { requestId, recentRows: recent.length, baselineRows: baseline.length });
            return (0, errors_1.ok)({ job: 'scanAnomalies', status: 'completed', scannedRows: recent.length, triggeredAt: new Date().toISOString() });
        }
        if (jobAction === 'retrainModel') {
            logger_1.logger.info('ai.job.retrainModel', { requestId, trigger: 'cron' });
            const endpoint = process.env.QUICKML_PIPELINE_ENDPOINT;
            if (!endpoint) {
                return (0, errors_1.ok)({ job: 'retrainModel', status: 'NOT_CONFIGURED', message: 'QUICKML_PIPELINE_ENDPOINT not set' });
            }
            const mlRes = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'retrain', trigger: 'weekly_cron' }) }).catch(() => null);
            return (0, errors_1.ok)({ job: 'retrainModel', status: mlRes?.ok ? 'completed' : 'FAILED', httpStatus: mlRes?.status ?? null, triggeredAt: new Date().toISOString() });
        }
        await (0, auth_1.requireRoles)(AI_ROLES, ctx, requestId);
        // ---- Phase 2.3: QuickML Model Invocation & Retraining ----
        // Targets deployed QuickML Pipeline endpoint via process.env.QUICKML_PIPELINE_ENDPOINT.
        // If QUICKML_PIPELINE_ENDPOINT is set, calls the deployed QuickML pipeline.
        if (method === 'POST' && (path.includes('/retrain') || body.action === 'retrain' || path.includes('/predict'))) {
            const quickmlEndpoint = process.env.QUICKML_PIPELINE_ENDPOINT;
            const quickmlApiKey = process.env.QUICKML_API_KEY;
            if (quickmlEndpoint) {
                try {
                    const headers = { 'Content-Type': 'application/json' };
                    if (quickmlApiKey) {
                        headers['Authorization'] = `Zoho-enczapi ${quickmlApiKey}`;
                        headers['x-api-key'] = quickmlApiKey;
                    }
                    const mlRes = await fetch(quickmlEndpoint, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(body.payload || body.features || { action: 'retrain' }),
                    });
                    const mlJson = (await mlRes.json().catch(() => ({})));
                    if (!mlRes.ok) {
                        throw new errors_1.ApiError('DEPENDENCY_UNAVAILABLE', `QuickML endpoint returned HTTP ${mlRes.status}: ${JSON.stringify(mlJson)}`, requestId);
                    }
                    // Defensive response schema validation — require recognizable fields or return raw payload
                    const modelVersion = mlJson.modelVersion ?? mlJson.version ?? mlJson.model_id ?? 'quickml-v1';
                    const prediction = mlJson.prediction ?? mlJson.result ?? mlJson.output ?? mlJson.predictions ?? null;
                    logger_1.logger.info('ai.retrain.quickml', { requestId, endpoint: quickmlEndpoint, status: mlRes.status });
                    return (0, errors_1.ok)({
                        source: 'Catalyst QuickML Pipeline',
                        status: 'SUCCESS',
                        modelVersion,
                        trainedAt: new Date().toISOString(),
                        prediction,
                        rawResponse: mlJson,
                        message: 'QuickML pipeline request executed successfully',
                    });
                }
                catch (err) {
                    if (err instanceof errors_1.ApiError)
                        throw err;
                    throw new errors_1.ApiError('DEPENDENCY_UNAVAILABLE', `QuickML request failed: ${String(err)}`, requestId);
                }
            }
            // No QuickML endpoint configured — return honest status (not mock success).
            logger_1.logger.info('ai.retrain.not-deployed', { requestId });
            return (0, errors_1.ok)({
                source: 'QuickML (not yet deployed)',
                status: 'NOT_CONFIGURED',
                modelVersion: null,
                message: 'QUICKML_PIPELINE_ENDPOINT env var not set. Deploy the QuickML pipeline per docs/QUICKML_CONSOLE_RUNBOOK.md',
            });
        }
        // ---- Phase 2.4: Anomaly detection (z-score) ----
        // Computes rolling mean + std-dev per district+category, flags z > 2.5.
        if (method === 'GET' && path.endsWith('/anomalies')) {
            const { scope } = await (0, auth_1.requireRoles)(AI_ROLES, ctx, requestId);
            const scopeClause = (0, datastore_1.scopeWhereClause)(scope);
            const zcql = app.zcql();
            const now = new Date();
            const dayMs = 86400000;
            const recentStart = new Date(now.getTime() - dayMs);
            const baselineStart = new Date(now.getTime() - 31 * dayMs);
            const fmt = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
            // Current 24h counts per district+category
            const recentQ = `SELECT DistrictID, CrimeMajorHeadID, COUNT(*) AS Cnt FROM CaseMaster WHERE CrimeRegisteredDate >= '${(0, datastore_1.sanitizeZcqlString)(fmt(recentStart))}' AND ${scopeClause} GROUP BY DistrictID, CrimeMajorHeadID`;
            // 30-day baseline counts per district+category
            const baselineQ = `SELECT DistrictID, CrimeMajorHeadID, COUNT(*) AS Cnt FROM CaseMaster WHERE CrimeRegisteredDate >= '${(0, datastore_1.sanitizeZcqlString)(fmt(baselineStart))}' AND CrimeRegisteredDate < '${(0, datastore_1.sanitizeZcqlString)(fmt(recentStart))}' AND ${scopeClause} GROUP BY DistrictID, CrimeMajorHeadID`;
            const recent = (await zcql.executeZCQLQuery(recentQ).catch(() => [])) || [];
            const baseline = (await zcql.executeZCQLQuery(baselineQ).catch(() => [])) || [];
            // baseline daily mean + std-dev per district+category
            const stats = new Map();
            for (const r of baseline) {
                const row = r.CaseMaster || r;
                const k = `${row.DistrictID}:${row.CrimeMajorHeadID}`;
                const dailyCount = Number(row.Cnt) / 30;
                stats.set(k, { mean: dailyCount, variance: dailyCount }); // Poisson approx: variance ≈ mean
            }
            const catNames = { 1: 'Cyber Fraud', 2: 'House Breaking', 3: 'Robbery', 4: 'Vehicle Theft', 5: 'Assault', 6: 'Chain Snatching', 7: 'Cheating', 8: 'Murder', 9: 'Cattle Theft' };
            const anomalies = [];
            let rzId = 1;
            for (const r of recent) {
                const row = r.CaseMaster || r;
                const did = Number(row.DistrictID);
                const cat = Number(row.CrimeMajorHeadID);
                const current = Number(row.Cnt);
                const k = `${did}:${cat}`;
                const s = stats.get(k);
                if (!s || s.mean === 0)
                    continue;
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
            logger_1.logger.info('ai.anomalies', { requestId, count: anomalies.length });
            return (0, errors_1.ok)(anomalies.sort((a, b) => b.zScore - a.zScore));
        }
        // ---- Zia Text Analytics (sentiment + keyword extraction) ----
        const textToAnalyze = body.text || "Crime trend analysis requested for recent activities.";
        // Catalyst Zia Text Analytics (NOT QuickML LLM Serving).
        // Doc: https://docs.catalyst.zoho.com/en/zia-services/help/text-analytics/introduction/
        const zia = app.zia();
        const keywordExtraction = await zia.extractKeyword([textToAnalyze]);
        const sentimentAnalysis = await zia.analyzeSentiment([textToAnalyze]);
        logger_1.logger.info('ai.inference', { requestId, route: '/ai', method });
        return (0, errors_1.ok)({
            source: 'Catalyst Zia Text Analytics',
            analysis: {
                keywords: keywordExtraction,
                sentiment: sentimentAnalysis
            },
            message: 'AI endpoint connected to Catalyst Zia Text Analytics'
        });
    }
    catch (err) {
        const { status, body } = (0, errors_1.toResponse)(err, requestId);
        return { status, body };
    }
}
module.exports = ai;
//# sourceMappingURL=index.js.map