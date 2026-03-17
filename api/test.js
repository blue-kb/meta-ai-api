import { fetchMetaInsights } from './utils.js';

export default async function handler(req, res) {
    const fields = ['actions', 'action_values'];
    const rows = await fetchMetaInsights('ad', fields, {
        time_range: JSON.stringify({ since: '2026-03-10', until: '2026-03-10' })
    });

    // Collect ALL unique action_types across every ad
    const allTypes = new Map(); // type -> { count, value }
    for (const row of rows) {
        for (const a of (row.actions || [])) {
            const entry = allTypes.get(a.action_type) || { count: 0, value: 0 };
            entry.count += parseFloat(a.value) || 0;
            allTypes.set(a.action_type, entry);
        }
        for (const a of (row.action_values || [])) {
            const entry = allTypes.get(a.action_type) || { count: 0, value: 0 };
            entry.value += parseFloat(a.value) || 0;
            allTypes.set(a.action_type, entry);
        }
    }

    // Sort and show all — highlight any with 'sub' in the name
    const result = Array.from(allTypes.entries())
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => a.type.localeCompare(b.type));

    const subTypes = result.filter(r => r.type.toLowerCase().includes('sub'));

    res.status(200).json({ total_ads: rows.length, sub_related: subTypes, all_types: result });
}
