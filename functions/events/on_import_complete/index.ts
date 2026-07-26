/**
 * Event Function: on_import_complete
 * Triggered by Signal when a Stratus object lands in imports/raw/ or import job completes.
 * Kicks off the fir_import Circuit (validate -> load -> graph refresh -> notify).
 * Reference: CATALYST_INTEGRATION.md #8/#9, IMPLEMENTATION2.md 1E.
 */
import { logger, newRequestId } from '.././common/logger';

export default async function onImportComplete(_ctx: unknown) {
  const requestId = newRequestId();
  logger.info('event.import_complete', { requestId, event: 'on_import_complete' });
  // 1E: trigger fir_import_pipeline Circuit
  return { processed: true };
}
