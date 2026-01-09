// Metrics Collector - Track application performance metrics
// 
// Why metrics matter:
// 1. Identify performance bottlenecks
// 2. Monitor error rates
// 3. Track agent execution times
// 4. Alert on anomalies
// 5. Capacity planning
//
// This is a simple in-memory implementation.
// For production, export to Prometheus/Grafana/Datadog.

import { logger } from './logger';

interface MetricValue {
    count: number;
    sum: number;
    min: number;
    max: number;
    values: number[]; // For percentile calculations
}

interface Counter {
    value: number;
    labels: Record<string, string>;
}

type MetricType = 'counter' | 'histogram' | 'gauge';

interface MetricDefinition {
    name: string;
    type: MetricType;
    help: string;
    labels?: string[];
}

// Metric definitions
const METRIC_DEFINITIONS: MetricDefinition[] = [
    { name: 'http_requests_total', type: 'counter', help: 'Total HTTP requests', labels: ['method', 'path', 'status'] },
    { name: 'http_request_duration_ms', type: 'histogram', help: 'HTTP request duration in milliseconds', labels: ['method', 'path'] },
    { name: 'agent_executions_total', type: 'counter', help: 'Total agent executions', labels: ['agent', 'status'] },
    { name: 'agent_execution_duration_ms', type: 'histogram', help: 'Agent execution duration in milliseconds', labels: ['agent'] },
    { name: 'openai_requests_total', type: 'counter', help: 'Total OpenAI API requests', labels: ['model', 'status'] },
    { name: 'openai_tokens_total', type: 'counter', help: 'Total tokens used', labels: ['model', 'type'] },
    { name: 'errors_total', type: 'counter', help: 'Total errors', labels: ['type', 'source'] },
];

// Storage
const counters = new Map<string, number>();
const histograms = new Map<string, MetricValue>();
const gauges = new Map<string, number>();

// Helper to create metric key from name and labels
function createKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
        return name;
    }
    const labelStr = Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
    return `${name}{${labelStr}}`;
}

/**
 * Increment a counter
 */
export function incrementCounter(
    name: string,
    labels?: Record<string, string>,
    value: number = 1
): void {
    const key = createKey(name, labels);
    const current = counters.get(key) || 0;
    counters.set(key, current + value);
}

/**
 * Record a histogram value (for timing/duration metrics)
 */
export function recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>
): void {
    const key = createKey(name, labels);
    let metric = histograms.get(key);

    if (!metric) {
        metric = {
            count: 0,
            sum: 0,
            min: Infinity,
            max: -Infinity,
            values: [],
        };
    }

    metric.count++;
    metric.sum += value;
    metric.min = Math.min(metric.min, value);
    metric.max = Math.max(metric.max, value);
    metric.values.push(value);

    // Keep only last 1000 values for percentile calculations
    if (metric.values.length > 1000) {
        metric.values.shift();
    }

    histograms.set(key, metric);
}

/**
 * Set a gauge value (for current state)
 */
export function setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = createKey(name, labels);
    gauges.set(key, value);
}

/**
 * Calculate percentile from sorted values
 */
function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

/**
 * Get histogram statistics
 */
export function getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
} | null {
    const key = createKey(name, labels);
    const metric = histograms.get(key);

    if (!metric || metric.count === 0) {
        return null;
    }

    const sorted = [...metric.values].sort((a, b) => a - b);

    return {
        count: metric.count,
        sum: metric.sum,
        avg: metric.sum / metric.count,
        min: metric.min,
        max: metric.max,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
    };
}

/**
 * Get all metrics in Prometheus format
 */
export function getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Add counter metrics
    for (const [key, value] of counters.entries()) {
        const def = METRIC_DEFINITIONS.find(d => key.startsWith(d.name));
        if (def && !lines.includes(`# HELP ${def.name} ${def.help}`)) {
            lines.push(`# HELP ${def.name} ${def.help}`);
            lines.push(`# TYPE ${def.name} counter`);
        }
        lines.push(`${key} ${value}`);
    }

    // Add histogram metrics
    for (const [key, metric] of histograms.entries()) {
        const baseName = key.split('{')[0];
        const labels = key.includes('{') ? key.slice(key.indexOf('{')) : '';
        const def = METRIC_DEFINITIONS.find(d => key.startsWith(d.name));

        if (def && !lines.includes(`# HELP ${def.name} ${def.help}`)) {
            lines.push(`# HELP ${def.name} ${def.help}`);
            lines.push(`# TYPE ${def.name} histogram`);
        }

        lines.push(`${baseName}_count${labels} ${metric.count}`);
        lines.push(`${baseName}_sum${labels} ${metric.sum}`);
    }

    // Add gauge metrics
    for (const [key, value] of gauges.entries()) {
        const def = METRIC_DEFINITIONS.find(d => key.startsWith(d.name));
        if (def && !lines.includes(`# HELP ${def.name} ${def.help}`)) {
            lines.push(`# HELP ${def.name} ${def.help}`);
            lines.push(`# TYPE ${def.name} gauge`);
        }
        lines.push(`${key} ${value}`);
    }

    return lines.join('\n');
}

/**
 * Get metrics summary as JSON
 */
export function getMetricsSummary(): Record<string, unknown> {
    const summary: Record<string, unknown> = {
        counters: Object.fromEntries(counters),
        histograms: {} as Record<string, unknown>,
        gauges: Object.fromEntries(gauges),
    };

    for (const [key] of histograms.entries()) {
        (summary.histograms as Record<string, unknown>)[key] = getHistogramStats(key.split('{')[0]);
    }

    return summary;
}

/**
 * Log metrics summary (for debugging)
 */
export function logMetricsSummary(): void {
    logger.info('Metrics Summary', { metrics: getMetricsSummary() });
}

/**
 * Track HTTP request (convenience function)
 */
export function trackRequest(
    method: string,
    path: string,
    status: number,
    durationMs: number
): void {
    incrementCounter('http_requests_total', { method, path, status: String(status) });
    recordHistogram('http_request_duration_ms', durationMs, { method, path });
}

/**
 * Track agent execution (convenience function)
 */
export function trackAgentExecution(
    agent: string,
    success: boolean,
    durationMs: number
): void {
    incrementCounter('agent_executions_total', { agent, status: success ? 'success' : 'error' });
    recordHistogram('agent_execution_duration_ms', durationMs, { agent });
}

/**
 * Track OpenAI API call (convenience function)
 */
export function trackOpenAICall(
    model: string,
    success: boolean,
    inputTokens: number,
    outputTokens: number
): void {
    incrementCounter('openai_requests_total', { model, status: success ? 'success' : 'error' });
    incrementCounter('openai_tokens_total', { model, type: 'input' }, inputTokens);
    incrementCounter('openai_tokens_total', { model, type: 'output' }, outputTokens);
}

/**
 * Track error (convenience function)
 */
export function trackError(type: string, source: string): void {
    incrementCounter('errors_total', { type, source });
}

export default {
    incrementCounter,
    recordHistogram,
    setGauge,
    getHistogramStats,
    getPrometheusMetrics,
    getMetricsSummary,
    logMetricsSummary,
    trackRequest,
    trackAgentExecution,
    trackOpenAICall,
    trackError,
};
