import type { AnalysisResult } from '@/types';

const DEFAULT_LABELS = ['MCU', 'Power', 'Sensor', 'Output'];

function pickLabels(analysis?: AnalysisResult): string[] {
    if (!analysis?.identifiedComponents?.length) return DEFAULT_LABELS;
    const labels = analysis.identifiedComponents
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 4)
        .map((c) => c.toUpperCase());
    return labels.length >= 2 ? labels : DEFAULT_LABELS;
}

export function buildFallbackSchematicSvg(
    description: string,
    analysis?: AnalysisResult
): string {
    const labels = pickLabels(analysis);
    const title = description.length > 50 ? `${description.slice(0, 47)}...` : description;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="420" viewBox="0 0 700 420">
  <rect width="700" height="420" fill="#ffffff"/>
  <text x="24" y="32" font-family="Arial, sans-serif" font-size="16" fill="#111">Circuit Diagram</text>
  <text x="24" y="52" font-family="Arial, sans-serif" font-size="12" fill="#555">${title}</text>

  <rect x="80" y="110" width="120" height="70" fill="#fff" stroke="#111" stroke-width="2"/>
  <text x="140" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#111">${labels[0]}</text>

  <rect x="260" y="110" width="120" height="70" fill="#fff" stroke="#111" stroke-width="2"/>
  <text x="320" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#111">${labels[1]}</text>

  <rect x="440" y="110" width="120" height="70" fill="#fff" stroke="#111" stroke-width="2"/>
  <text x="500" y="150" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#111">${labels[2] || 'IO'}</text>

  <rect x="260" y="240" width="120" height="70" fill="#fff" stroke="#111" stroke-width="2"/>
  <text x="320" y="280" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#111">${labels[3] || 'OUTPUT'}</text>

  <line x1="200" y1="145" x2="260" y2="145" stroke="#111" stroke-width="2"/>
  <line x1="380" y1="145" x2="440" y2="145" stroke="#111" stroke-width="2"/>
  <line x1="320" y1="180" x2="320" y2="240" stroke="#111" stroke-width="2"/>

  <text x="225" y="132" font-family="Arial, sans-serif" font-size="10" fill="#111">DATA</text>
  <text x="400" y="132" font-family="Arial, sans-serif" font-size="10" fill="#111">BUS</text>
  <text x="332" y="215" font-family="Arial, sans-serif" font-size="10" fill="#111">PWM</text>

  <line x1="80" y1="300" x2="620" y2="300" stroke="#111" stroke-width="1" stroke-dasharray="6 6"/>
  <text x="24" y="306" font-family="Arial, sans-serif" font-size="10" fill="#777">Auto-generated schematic (demo)</text>
</svg>`;
}
