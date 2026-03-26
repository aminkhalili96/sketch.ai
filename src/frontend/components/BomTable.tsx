'use client';

import ReactMarkdown from 'react-markdown';
import { parseBomTable } from '@/shared/domain/bom';
import { MarkdownContent } from './MarkdownContent';

const NUMERIC_HEADERS = new Set(['qty', 'unit price', 'ext price', 'price', 'cost']);

function isNumericColumn(header: string): boolean {
    const lowered = header.toLowerCase();
    return Array.from(NUMERIC_HEADERS).some((key) => lowered.includes(key));
}

function isMonoColumn(header: string): boolean {
    const lowered = header.toLowerCase();
    return lowered.includes('mpn') || lowered.includes('part') || lowered.includes('sku');
}

interface BomTableProps {
    content: string;
}

export function BomTable({ content }: BomTableProps) {
    const parsed = parseBomTable(content);
    if (!parsed) {
        return <MarkdownContent content={content} />;
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-background">
            <table className="min-w-full text-xs">
                <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                        {parsed.headers.map((header, idx) => (
                            <th
                                key={`${header}-${idx}`}
                                className={`px-3 py-2 text-left font-medium border-b border-neutral-200 ${isNumericColumn(header) ? 'text-right' : ''}`}
                            >
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                    {parsed.rows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`} className="hover:bg-neutral-50">
                            {row.map((cell, colIndex) => {
                                const header = parsed.headers[colIndex] ?? '';
                                const numeric = isNumericColumn(header);
                                const mono = isMonoColumn(header);
                                return (
                                    <td
                                        key={`cell-${rowIndex}-${colIndex}`}
                                        className={`px-3 py-2 align-top ${numeric ? 'text-right' : ''} ${mono ? 'font-mono text-[11px]' : ''}`}
                                    >
                                        <ReactMarkdown
                                            components={{
                                                p: ({ children }) => <span>{children}</span>,
                                                a: ({ children, ...props }) => (
                                                    <a
                                                        {...props}
                                                        className="text-blue-600 hover:text-blue-700 underline"
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        {children}
                                                    </a>
                                                ),
                                            }}
                                        >
                                            {cell || '-'}
                                        </ReactMarkdown>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
