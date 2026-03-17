import { fetchMetaInsights } from './utils.js';

const SUBSCRIBE_ID = 'offsite_conversion.custom.2045351792704561';

export default async function handler(req, res) {
    const timeRange = JSON.stringify({ since: '2026-03-10', until: '2026-03-10' });

    // Fetch ad-level with current params (includes action_attribution_windows)
    const rows = await fetchMetaInsights('ad', ['actions', 'action_values', 'spend'], {
        time_range: timeRange
    });

    // Find the raw action object for the subscribe ID — show ALL fields, not just .value
    let subscribeRawObjects = [];
    let totalValueField = 0;
    let total7dClick = 0;
    let total1dView = 0;

    for (const row of rows) {
        for (const a of (row.actions || [])) {
            if (a.action_type === SUBSCRIBE_ID) {
                subscribeRawObjects.push({ ad_id: row.ad_id, raw: a });
                totalValueField += parseFloat(a.value) || 0;
                total7dClick += parseFloat(a['7d_click']) || 0;
                total1dView += parseFloat(a['1d_view']) || 0;
            }
        }
    }

    // Also fetch without attribution windows to compare
    // (override by not passing action_attribution_windows via extraParams —
    //  but since fetchMetaInsights now always includes it, just show what we get)

    res.status(200).json({
        subscribe_id: SUBSCRIBE_ID,
        total_ads: rows.length,
        ads_with_subscribe: subscribeRawObjects.length,
        // These three are key: which field matches Ads Manager count of 14?
        sum_of_action_value_field: totalValueField,   // what parseMetaAction reads
        sum_of_7d_click_field: total7dClick,
        sum_of_1d_view_field: total1dView,
        // First 3 raw subscribe action objects so we can see ALL fields returned
        sample_raw_objects: subscribeRawObjects.slice(0, 5),
    });
}
