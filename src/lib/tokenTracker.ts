// Token Usage Tracker - Monitor OpenAI API costs
// 
// Why token tracking matters:
// 1. OpenAI API costs money ($0.01-0.03 per 1K tokens for GPT-4)
// 2. Without tracking, costs can spiral out of control
// 3. Helps optimize prompts to reduce costs
// 4. Essential for budgeting and billing customers
//
// Token pricing (approximate, check OpenAI for current rates):
// - gpt-4o: $5/1M input, $15/1M output
// - gpt-4-turbo: $10/1M input, $30/1M output
// - gpt-5.2: ~$15/1M input, $45/1M output (estimated)

import { logger } from './logger';

interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    model: string;
    timestamp: string;
}

interface UsageSummary {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    requestCount: number;
    byModel: Record<string, {
        inputTokens: number;
        outputTokens: number;
        costUsd: number;
        count: number;
    }>;
}

// Pricing per 1M tokens (USD) - update as needed
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 5, output: 15 },
    'gpt-4-turbo': { input: 10, output: 30 },
    'gpt-4.5-turbo': { input: 7.5, output: 22.5 },
    'gpt-5.2': { input: 15, output: 45 },
    'gpt-4': { input: 30, output: 60 },
    // Fallback for unknown models
    'default': { input: 10, output: 30 },
};

// In-memory usage store (reset on server restart)
// For production, persist to database
const usageHistory: TokenUsage[] = [];
const MAX_HISTORY = 10000; // Keep last 10K requests

/**
 * Track token usage from an API response
 */
export function trackTokenUsage(
    model: string,
    inputTokens: number,
    outputTokens: number,
    requestId?: string
): TokenUsage {
    const pricing = TOKEN_PRICING[model] || TOKEN_PRICING['default'];
    const estimatedCostUsd =
        (inputTokens * pricing.input / 1_000_000) +
        (outputTokens * pricing.output / 1_000_000);

    const usage: TokenUsage = {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd,
        model,
        timestamp: new Date().toISOString(),
    };

    // Store usage
    usageHistory.push(usage);
    if (usageHistory.length > MAX_HISTORY) {
        usageHistory.shift(); // Remove oldest
    }

    // Log usage
    logger.info('Token usage tracked', {
        requestId,
        model,
        inputTokens,
        outputTokens,
        totalTokens: usage.totalTokens,
        estimatedCost: `$${estimatedCostUsd.toFixed(4)}`,
    });

    return usage;
}

/**
 * Get usage summary for a time period
 */
export function getUsageSummary(sinceTimestamp?: string): UsageSummary {
    const since = sinceTimestamp ? new Date(sinceTimestamp).getTime() : 0;

    const filtered = usageHistory.filter(
        u => new Date(u.timestamp).getTime() >= since
    );

    const summary: UsageSummary = {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        requestCount: filtered.length,
        byModel: {},
    };

    for (const usage of filtered) {
        summary.totalInputTokens += usage.inputTokens;
        summary.totalOutputTokens += usage.outputTokens;
        summary.totalTokens += usage.totalTokens;
        summary.totalCostUsd += usage.estimatedCostUsd;

        if (!summary.byModel[usage.model]) {
            summary.byModel[usage.model] = {
                inputTokens: 0,
                outputTokens: 0,
                costUsd: 0,
                count: 0,
            };
        }
        summary.byModel[usage.model].inputTokens += usage.inputTokens;
        summary.byModel[usage.model].outputTokens += usage.outputTokens;
        summary.byModel[usage.model].costUsd += usage.estimatedCostUsd;
        summary.byModel[usage.model].count++;
    }

    return summary;
}

/**
 * Get today's usage summary
 */
export function getTodayUsage(): UsageSummary {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return getUsageSummary(today.toISOString());
}

/**
 * Format cost for display
 */
export function formatCost(costUsd: number): string {
    if (costUsd < 0.01) {
        return `$${(costUsd * 100).toFixed(2)}¢`;
    }
    return `$${costUsd.toFixed(2)}`;
}

/**
 * Estimate cost for a prompt before sending
 * Useful for cost warnings
 */
export function estimateCost(
    model: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number = 500
): { estimatedCostUsd: number; warning?: string } {
    const pricing = TOKEN_PRICING[model] || TOKEN_PRICING['default'];
    const estimatedCostUsd =
        (estimatedInputTokens * pricing.input / 1_000_000) +
        (estimatedOutputTokens * pricing.output / 1_000_000);

    let warning: string | undefined;
    if (estimatedCostUsd > 0.10) {
        warning = `High cost estimate: ${formatCost(estimatedCostUsd)}`;
    }

    return { estimatedCostUsd, warning };
}

/**
 * Log a warning if daily budget is exceeded
 */
export function checkDailyBudget(budgetUsd: number = 10): boolean {
    const todayUsage = getTodayUsage();
    if (todayUsage.totalCostUsd > budgetUsd) {
        logger.warn('Daily budget exceeded!', {
            budget: formatCost(budgetUsd),
            spent: formatCost(todayUsage.totalCostUsd),
            requestCount: todayUsage.requestCount,
        });
        return true;
    }
    return false;
}

export default {
    trackTokenUsage,
    getUsageSummary,
    getTodayUsage,
    formatCost,
    estimateCost,
    checkDailyBudget,
};
