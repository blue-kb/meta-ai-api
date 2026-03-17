import { fetchMetaInsights } from './utils.js';

const SUBSCRIBE_ID = 'offsite_conversion.custom.2045351792704561';

// Ground truth from Meta Ads Manager CSV export
const CSV_TRUTH = {
    '2026-03-01': 16, '2026-03-02': 24, '2026-03-03': 15,
    '2026-03-04': 18, '2026-03-05': 18, '2026-03-06': 12,
    '2026-03-07': 17, '2026-03-08': 14, '2026-03-09': 14,
    '2026-03-10': 14, '2026-03-11': 15, '2026-03-12': 9,
    '2026-03-13': 9,  '2026-03-14': 11, '2026-03-15': 15,
    '2026-03-16': 14, '2026-03-17': 15,
};

export default async function handler(req, res) {
    // Fetch campaign level for all of March 1-17 in one call
    const rows = await fetchMetaInsights('campaign', ['actions', 'action_values', 'spend', 'campaign_name'], {
        time_range: JSON.stringify({ since: '2026-03-01', until: '2026-03-17' })
    });

    // Aggregate subscribe count per date (sum across all campaigns per day)
    const byDate = {};
    for (const row of rows) {
        const date = row.date_start;
        if (!byDate[date]) byDate[date] = 0;
        for (const a of (row.actions || [])) {
            if (a.action_type === SUBSCRIBE_ID) {
                byDate[date] += parseFloat(a.value) || 0;
            }
        }
    }

    // Compare API vs CSV for each date
    const comparison = Object.keys(CSV_TRUTH).sort().map(date => {
        const api = byDate[date] || 0;
        const csv = CSV_TRUTH[date];
        return { date, api, csv, diff: api - csv, pct_off: csv > 0 ? Math.round((api - csv) / csv * 100) + '%' : 'N/A' };
    });

    const totalApi = comparison.reduce((s, r) => s + r.api, 0);
    const totalCsv = comparison.reduce((s, r) => s + r.csv, 0);

    res.status(200).json({
        comparison,
        totals: { api: totalApi, csv: totalCsv, diff: totalApi - totalCsv }
    });
}
