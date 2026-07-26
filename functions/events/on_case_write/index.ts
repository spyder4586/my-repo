/**
 * Event Function: on_case_write
 * Triggered by Signal when CaseMaster row is inserted/updated.
 * Marks affected unit-day aggregates dirty for incremental rebuild.
 * Reference: CATALYST_INTEGRATION.md #8, BACKEND_ARCHITECTURE.md #6.
 */
import { logger, newRequestId } from '.././common/logger';

export default async function onCaseWrite(_ctx: unknown) {
  const requestId = newRequestId();
  logger.info('event.case_write', { requestId, event: 'on_case_write' });
  // 1E/2B: touch Agg dirty flags -> recompute aggregates async
  return { processed: true };
}
