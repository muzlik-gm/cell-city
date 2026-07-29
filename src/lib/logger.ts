// Server-side logging utility with structured output.

type LogLevel = "info" | "warn" | "error" | "debug";

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

function formatLog(level: LogLevel, message: string, meta?: Record<string, any>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? " " + JSON.stringify(meta) : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  info(message: string, meta?: Record<string, any>) {
    if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.info) {
      console.log(formatLog("info", message, meta));
    }
  },
  warn(message: string, meta?: Record<string, any>) {
    if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.warn) {
      console.warn(formatLog("warn", message, meta));
    }
  },
  error(message: string, meta?: Record<string, any>) {
    if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.error) {
      console.error(formatLog("error", message, meta));
    }
  },
  debug(message: string, meta?: Record<string, any>) {
    if (LOG_LEVELS[MIN_LEVEL] <= LOG_LEVELS.debug) {
      console.debug(formatLog("debug", message, meta));
    }
  },
};

/// Logs an API request with method, path, status, and duration.
export function logRequest(method: string, path: string, status: number, durationMs: number, error?: string) {
  const level: LogLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  logger[level](`${method} ${path} ${status} ${durationMs}ms`, { error: error?.slice(0, 200) });
}
