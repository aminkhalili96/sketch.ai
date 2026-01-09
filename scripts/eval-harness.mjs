import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const datasetPath = path.join(rootDir, 'doc', 'eval', 'benchmarks.json');
const resultsDir = path.join(rootDir, 'doc', 'eval');

const args = process.argv.slice(2);
const baseUrlArgIndex = args.findIndex((arg) => arg === '--base-url');
const baseUrl =
    baseUrlArgIndex !== -1 && args[baseUrlArgIndex + 1]
        ? args[baseUrlArgIndex + 1]
        : 'http://localhost:3000';
const includeBom = args.includes('--bom');

function inferKindFromScene(elements) {
    if (!Array.isArray(elements) || elements.length === 0) return 'enclosure';

    const names = elements
        .map((el) => (typeof el.name === 'string' ? el.name.toLowerCase() : ''))
        .join(' ');
    if (names.includes('enclosure') || names.includes('lid') || names.includes('pcb')) return 'enclosure';

    const enclosureLike = new Set(['box', 'rounded-box']);
    const enclosureCount = elements.filter((el) => enclosureLike.has(el.type)).length;
    const organicCount = elements.filter((el) => el.type === 'sphere' || el.type === 'capsule').length;

    if (organicCount >= Math.max(2, Math.ceil(elements.length * 0.4)) && organicCount > enclosureCount) {
        return 'object';
    }
    if (enclosureCount >= Math.ceil(elements.length * 0.6)) return 'enclosure';
    return 'enclosure';
}

function bomLooksValid(text) {
    if (typeof text !== 'string' || !text.trim()) return false;
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    const header = lines.find((l) => l.startsWith('| Item |'));
    if (!header) return false;
    const required = ['MPN', 'Manufacturer', 'Qty', 'Unit Price', 'Ext Price', 'Supplier'];
    return required.every((label) => header.includes(label));
}

function formatDuration(ms) {
    return `${Math.round(ms)}ms`;
}

async function run() {
    const datasetRaw = await fs.readFile(datasetPath, 'utf8');
    const dataset = JSON.parse(datasetRaw);
    const cases = Array.isArray(dataset.cases) ? dataset.cases : [];

    const results = [];
    for (const testCase of cases) {
        const started = Date.now();
        const outputTypes = ['scene-json'];
        if (includeBom) outputTypes.push('bom');

        const payload = {
            projectDescription: testCase.description,
            outputTypes,
        };

        let response;
        try {
            response = await fetch(`${baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            results.push({
                id: testCase.id,
                description: testCase.description,
                success: false,
                error: `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                latencyMs: Date.now() - started,
            });
            continue;
        }

        const latencyMs = Date.now() - started;
        const body = await response.json().catch(() => null);
        if (!body || !body.success) {
            results.push({
                id: testCase.id,
                description: testCase.description,
                success: false,
                error: body?.error || 'API error',
                latencyMs,
            });
            continue;
        }

        const sceneJson = body.outputs?.['scene-json'];
        let sceneValid = false;
        let elementsCount = 0;
        let inferredKind = 'enclosure';
        if (typeof sceneJson === 'string') {
            try {
                const parsed = JSON.parse(sceneJson);
                const elements = Array.isArray(parsed) ? parsed : parsed?.elements;
                if (Array.isArray(elements)) {
                    sceneValid = true;
                    elementsCount = elements.length;
                    inferredKind = inferKindFromScene(elements);
                }
            } catch {
                sceneValid = false;
            }
        }

        const kindMatch =
            testCase.expectedKind ? inferredKind === testCase.expectedKind : true;
        const elementCountOk =
            typeof testCase.minElements === 'number'
                ? elementsCount >= testCase.minElements
                : true;

        const bomOutput = body.outputs?.bom;
        const bomValid = includeBom ? bomLooksValid(bomOutput) : undefined;

        results.push({
            id: testCase.id,
            description: testCase.description,
            success: true,
            latencyMs,
            sceneValid,
            elementsCount,
            inferredKind,
            expectedKind: testCase.expectedKind,
            kindMatch,
            elementCountOk,
            bomValid,
        });
    }

    const total = results.length;
    const successes = results.filter((r) => r.success).length;
    const validScenes = results.filter((r) => r.success && r.sceneValid).length;
    const kindMatches = results.filter((r) => r.success && r.kindMatch).length;
    const countOk = results.filter((r) => r.success && r.elementCountOk).length;
    const bomValidCount = includeBom
        ? results.filter((r) => r.success && r.bomValid).length
        : 0;
    const avgLatency =
        results.length > 0
            ? results.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / results.length
            : 0;

    const summary = {
        runAt: new Date().toISOString(),
        baseUrl,
        offlineMode: process.env.USE_OFFLINE_MODEL === 'true',
        models: {
            vision: process.env.OLLAMA_VISION_MODEL || 'llava:7b',
            text: process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:7b',
        },
        totalCases: total,
        successRate: total ? successes / total : 0,
        sceneValidityRate: total ? validScenes / total : 0,
        kindAccuracy: total ? kindMatches / total : 0,
        elementCountRate: total ? countOk / total : 0,
        bomValidityRate: includeBom && total ? bomValidCount / total : undefined,
        avgLatencyMs: avgLatency,
    };

    await fs.mkdir(resultsDir, { recursive: true });
    const resultsJsonPath = path.join(resultsDir, 'results.json');
    const resultsMdPath = path.join(resultsDir, 'results.md');

    await fs.writeFile(
        resultsJsonPath,
        JSON.stringify({ summary, results }, null, 2),
        'utf8'
    );

    const rows = results
        .map((r) => {
            const status = r.success ? 'ok' : 'fail';
            const kind = r.success ? `${r.inferredKind}/${r.expectedKind || '-'}` : '-';
            const scene = r.success ? (r.sceneValid ? 'valid' : 'invalid') : '-';
            const count = r.success ? String(r.elementsCount) : '-';
            const countOkValue = r.success ? (r.elementCountOk ? 'yes' : 'no') : '-';
            const bom = includeBom ? (r.success ? (r.bomValid ? 'valid' : 'invalid') : '-') : '-';
            return `| ${r.id} | ${status} | ${scene} | ${kind} | ${count} | ${countOkValue} | ${bom} | ${formatDuration(r.latencyMs)} |`;
        })
        .join('\n');

    const summaryMd = `# Evaluation Results

Run at: ${summary.runAt}
Base URL: ${summary.baseUrl}
Offline mode: ${summary.offlineMode ? 'true' : 'false'}
Models: vision=${summary.models.vision}, text=${summary.models.text}

## Summary
- Success rate: ${(summary.successRate * 100).toFixed(1)}%
- Scene validity: ${(summary.sceneValidityRate * 100).toFixed(1)}%
- Kind accuracy: ${(summary.kindAccuracy * 100).toFixed(1)}%
- Element count OK: ${(summary.elementCountRate * 100).toFixed(1)}%
${includeBom ? `- BOM validity: ${(summary.bomValidityRate * 100).toFixed(1)}%` : ''}
- Avg latency: ${formatDuration(summary.avgLatencyMs)}

## Per-case
| Case | Status | Scene | Kind (got/expected) | Elements | Count OK | BOM | Latency |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
`;

    await fs.writeFile(resultsMdPath, summaryMd, 'utf8');
    console.log(`Wrote results to ${resultsJsonPath} and ${resultsMdPath}`);
}

run().catch((error) => {
    console.error('Evaluation failed:', error);
    process.exit(1);
});
