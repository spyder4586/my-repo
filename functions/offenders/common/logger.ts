/**
 * Structured logger. No PII is ever logged (no BriefFacts, no names).
 * Reference: BACKEND_ARCHITECTURE.md #10 Observability, SECURITY.md
 */
import { config } from './config';

export interface LogContext {
  requestId?: string;
  userId?: string;
  role?: string;
  route?: string;
  [key: string]: unknown;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, ctx?: LogContext): void {
  const lvl = config().logLevel;
  if (level === 'debug' && lvl !== 'debug') return;
  const line = JSON.stringify({
    level,
    msg,
    ts: new Date().toISOString(),
    ...ctx,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line); // eslint-disable-line no-console
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => emit('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit('warn', msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit('error', msg, ctx),
};

/** Generate a short correlation id for request tracing. */
export function newRequestId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}
