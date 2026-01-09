// Structured Logger - Production-grade logging with levels, request IDs, and JSON format
// 
// Why structured logging matters:
// 1. Log aggregation (ELK, CloudWatch, Datadog) requires parseable format
// 2. Request ID tracking enables distributed tracing
// 3. Log levels allow filtering in production (disable debug in prod)
// 4. Consistent format makes debugging easier

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    requestId?: string;
    userId?: string;
    agent?: string;
    duration?: number;
    [key: string]: unknown;
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

// Configuration
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const LOG_FORMAT = process.env.LOG_FORMAT || 'json'; // 'json' | 'pretty'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

function formatLog(entry: LogEntry): string {
    if (LOG_FORMAT === 'pretty') {
        const levelColors: Record<LogLevel, string> = {
            debug: '\x1b[36m', // cyan
            info: '\x1b[32m',  // green
            warn: '\x1b[33m',  // yellow
            error: '\x1b[31m', // red
        };
        const reset = '\x1b[0m';
        const color = levelColors[entry.level];

        let msg = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.message}`;
        if (entry.context) {
            msg += ` ${JSON.stringify(entry.context)}`;
        }
        if (entry.error) {
            msg += `\n  Error: ${entry.error.message}`;
            if (entry.error.stack) {
                msg += `\n  Stack: ${entry.error.stack}`;
            }
        }
        return msg;
    }

    // Default: JSON format (for log aggregation)
    return JSON.stringify(entry);
}

function createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
): LogEntry {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
    };

    if (context && Object.keys(context).length > 0) {
        entry.context = context;
    }

    if (error) {
        entry.error = {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
        };
    }

    return entry;
}

function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!shouldLog(level)) return;

    const entry = createLogEntry(level, message, context, error);
    const formatted = formatLog(entry);

    switch (level) {
        case 'error':
            console.error(formatted);
            break;
        case 'warn':
            console.warn(formatted);
            break;
        default:
            console.log(formatted);
    }
}

// Public API
export const logger = {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext, error?: Error) => log('warn', message, context, error),
    error: (message: string, context?: LogContext, error?: Error) => log('error', message, context, error),

    // Create a child logger with preset context
    child: (baseContext: LogContext) => ({
        debug: (message: string, context?: LogContext) =>
            log('debug', message, { ...baseContext, ...context }),
        info: (message: string, context?: LogContext) =>
            log('info', message, { ...baseContext, ...context }),
        warn: (message: string, context?: LogContext, error?: Error) =>
            log('warn', message, { ...baseContext, ...context }, error),
        error: (message: string, context?: LogContext, error?: Error) =>
            log('error', message, { ...baseContext, ...context }, error),
    }),

    // Request-scoped logger
    forRequest: (requestId: string) => ({
        debug: (message: string, context?: LogContext) =>
            log('debug', message, { requestId, ...context }),
        info: (message: string, context?: LogContext) =>
            log('info', message, { requestId, ...context }),
        warn: (message: string, context?: LogContext, error?: Error) =>
            log('warn', message, { requestId, ...context }, error),
        error: (message: string, context?: LogContext, error?: Error) =>
            log('error', message, { requestId, ...context }, error),
    }),
};

// Generate unique request ID
export function generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Utility to measure execution time
export function createTimer(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
}

export default logger;
