/**
 * Health Function — GET /api/v1/health
 * Public (auth:false). Returns service status + environment.
 * Reference: IMPLEMENTATION2.md 0B/0C, API_REFERENCE.md "GET /api/v1/health".
 */
import { config } from './common/config';
import { logger, newRequestId } from './common/logger';
import { ok } from './common/errors';

export default async function health(_context: any, basicIO?: any) {
  const requestId = newRequestId();
  const cfg = config();
  logger.info('health.check', { requestId, route: '/health' });
  const resData = ok({ status: 'ok', env: cfg.env });
  if (basicIO && typeof basicIO.write === 'function') {
    basicIO.write(JSON.stringify(resData));
    basicIO.close();
  }
  return resData;
}

module.exports = health;
