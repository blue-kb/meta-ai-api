import { fetchMetaInsights } from './utils.js';

const SUBSCRIBE_ID = 'offsite_conversion.custom.2045351792704561';

async function getSubscribeStats(level, params) {
    const rows = await fetchMetaInsights(level, ['actions', 'action_values', 'spend', 'campaign_name', 'adset_name', 'ad_name'], params);
    const result = [];
    for (const row of rows) {
        for (const a of (row.actions || [])) {
            if (a.action_type === SUBSCRIBE_ID) {
                result.push({
                    name: row.campaign_name || row.adset_name || row.ad_name || '?',
                    value_field: parseFloat(a.value) || 0,
                    '7d_click': parseFloat(a['7d_click']) || 0,
                    '1d_view': parseFloat(a['1d_view']) || 0,
                });
            }
        }
    }
    return result;
}

export default async function handler(req, res) {
    const timeRange = JSON.stringify({ since: '2026-03-10', until: '2026-03-10' });
    const params = { time_range: timeRange };

    const [campData, adsetData] = await Promise.all([
        getSubscribeStats('campaign', params),
        getSubscribeStats('adset', params),
    ]);

    const campTotal = campData.reduce((s, r) => ({ v: s.v + r.value_field, c: s.c + r['7d_click'], i: s.i + r['1d_view'] }), { v: 0, c: 0, i: 0 });
    const adsetTotal = adsetData.reduce((s, r) => ({ v: s.v + r.value_field, c: s.c + r['7d_click'], i: s.i + r['1d_view'] }), { v: 0, c: 0, i: 0 });

    // Ads Manager CSV shows: report-sales-incr-daily-2 = 14 subscribes, membership-retargeting-incr-1 = 0
    // So total = 14. We're checking which field/level matches that.
    res.status(200).json({
        note: 'Ads Manager CSV shows 14 subscribes on 2026-03-10 for this account',
        campaign_level: {
            rows_with_subscribe: campData.length,
            sum_value_field: campTotal.v,
            sum_7d_click: campTotal.c,
            sum_1d_view: campTotal.i,
            detail: campData,
        },
        adset_level: {
            rows_with_subscribe: adsetData.length,
            sum_value_field: adsetTotal.v,
            sum_7d_click: adsetTotal.c,
            sum_1d_view: adsetTotal.i,
        },
    });
}
