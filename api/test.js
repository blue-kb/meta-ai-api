import { fetchMetaInsights } from './utils.js';

export default async function handler(req, res) {
    const fields = ['actions', 'action_values'];
    const rows = await fetchMetaInsights('ad', fields, {
        time_range: JSON.stringify({ since: '2026-03-10', until: '2026-03-10' }),
        limit: 3
    });
    const sample = rows.slice(0, 3).map(r => ({
        ad_name: r.ad_name,
        actions: r.actions || [],
        action_values: r.action_values || []
    }));
    res.status(200).json({ sample });
}
