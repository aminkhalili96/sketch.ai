export function buildProjectDescription(
    description?: string | null,
    summary?: string | null
): string {
    const desc = typeof description === 'string' ? description.trim() : '';
    const sum = typeof summary === 'string' ? summary.trim() : '';

    if (!desc && !sum) return '';
    if (!desc) return sum;
    if (!sum) return desc;

    const lowerDesc = desc.toLowerCase();
    const lowerSum = sum.toLowerCase();

    if (lowerDesc.includes(lowerSum)) return desc;
    if (lowerSum.includes(lowerDesc)) return sum;

    return `${sum}\nUser notes: ${desc}`;
}
