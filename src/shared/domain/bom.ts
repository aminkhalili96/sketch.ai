export type BomTable = {
    headers: string[];
    rows: string[][];
    raw: string;
};

function isSeparatorLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.includes('|')) return false;
    const cells = trimmed
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);
    if (cells.length === 0) return false;
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function splitRow(line: string): string[] {
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells[0] === '') cells.shift();
    if (cells[cells.length - 1] === '') cells.pop();
    return cells;
}

export function extractBomTable(markdown: string): string | null {
    if (!markdown || typeof markdown !== 'string') return null;
    const lines = markdown.split(/\r?\n/);
    let headerIndex = -1;

    for (let i = 0; i < lines.length - 1; i++) {
        if (!lines[i].includes('|')) continue;
        if (isSeparatorLine(lines[i + 1])) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) return null;

    const tableLines = [lines[headerIndex], lines[headerIndex + 1]];
    for (let i = headerIndex + 2; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) break;
        if (!line.includes('|')) break;
        tableLines.push(line);
    }

    return tableLines.join('\n').trim();
}

export function parseBomTable(markdown: string): BomTable | null {
    const table = extractBomTable(markdown) ?? markdown?.trim();
    if (!table) return null;

    const lines = table.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2 || !isSeparatorLine(lines[1])) return null;

    const headers = splitRow(lines[0]);
    if (headers.length === 0) return null;

    const rows = lines.slice(2).map((line) => {
        const cells = splitRow(line);
        if (cells.length <= headers.length) {
            return [...cells, ...Array(headers.length - cells.length).fill('')];
        }
        const overflow = cells.slice(headers.length - 1).join(' | ');
        return [...cells.slice(0, headers.length - 1), overflow];
    });

    return { headers, rows, raw: table };
}

export function normalizeBomMarkdown(markdown: string): string {
    const table = extractBomTable(markdown);
    return table ? table.trim() : markdown.trim();
}
