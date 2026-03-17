import { fetchMetaInsights } from './utils.js';

const SUBSCRIBE_ID = 'offsite_conversion.custom.2045351792704561';

async function collectTypes(level, fields, params) {
    const rows = await fetchMetaInsights(level, fields, params);
    const actMap = new Map();
    const cpMap = new Map();
    for (const row of rows) {
        for (const a of (row.actions || [])) {
            const e = actMap.get(a.action_type) || { count: 0, value: 0 };
            e.count += parseFloat(a.value) || 0;
            actMap.set(a.action_type, e);
        }
        for (const a of (row.action_values || [])) {
            const e = actMap.get(a.action_type) || { count: 0, value: 0 };
            e.value += parseFloat(a.value) || 0;
            actMap.set(a.action_type, e);
        }
        for (const a of (row.cost_per_action_type || [])) {
            const e = cpMap.get(a.action_type) || { cost: 0 };
            e.cost += parseFloat(a.value) || 0;
            cpMap.set(a.action_type, e);
        }
    }
    return { rows: rows.length, actMap, cpMap };
}

export default async function handler(req, res) {
    const timeRange = JSON.stringify({ since: '2026-03-10', until: '2026-03-10' });
    const fields = ['actions', 'action_values', 'cost_per_action_type'];

    const [adData, acctData] = await Promise.all([
        collectTypes('ad', fields, { time_range: timeRange }),
        collectTypes('account', fields, { time_range: timeRange }),
    ]);

    // Build result for the subscribe custom ID at both levels
    const subAd = adData.actMap.get(SUBSCRIBE_ID) || { count: 0, value: 0 };
    const subAcct = acctData.actMap.get(SUBSCRIBE_ID) || { count: 0, value: 0 };
    const cpAd = adData.cpMap.get(SUBSCRIBE_ID) || { cost: 0 };
    const cpAcct = acctData.cpMap.get(SUBSCRIBE_ID) || { cost: 0 };

    // All action types at account level (to check if subscribe ID appears at all)
    const acctTypes = Array.from(acctData.actMap.entries())
        .map(([type, d]) => ({ type, ...d }))
        .sort((a, b) => a.type.localeCompare(b.type));

    // All cost_per_action_type entries at campaign level (to find subscribe cost key)
    const adCpTypes = Array.from(adData.cpMap.entries())
        .map(([type, d]) => ({ type, ...d }))
        .filter(r => r.type.includes('custom') || r.type.includes('sub') || r.type.includes('purchase'))
        .sort((a, b) => a.type.localeCompare(b.type));

    res.status(200).json({
        subscribe_id: SUBSCRIBE_ID,
        ad_level: {
            rows: adData.rows,
            subscribe_count: subAd.count,
            subscribe_value: subAd.value,
            cost_per_subscribe: cpAd.cost,
        },
        account_level: {
            rows: acctData.rows,
            subscribe_count: subAcct.count,
            subscribe_value: subAcct.value,
            cost_per_subscribe: cpAcct.cost,
            all_action_types: acctTypes,
        },
        cost_per_action_type_sample: adCpTypes,
    });
}
