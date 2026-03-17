import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, ADSET_HEADERS, COMMON_INSIGHT_FIELDS, buildMetricsRow, safeValue } from '../utils.js';

export default async function handler(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();
        const fields = [
            ...COMMON_INSIGHT_FIELDS,
            'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
            'objective', 'buying_type',
            'optimization_goal', 'bid_strategy',
            'daily_budget', 'lifetime_budget', 'budget_remaining',
            'start_time', 'end_time'
        ];

        let startDate, endDate;
        if (req.query.start && req.query.end) {
            startDate = req.query.start;
            endDate = req.query.end;
        } else {
            const d = req.query.date || getYesterdayDateString();
            startDate = endDate = d;
        }

        const insights = await fetchMetaInsights('adset', fields, {
            time_range: JSON.stringify({ since: startDate, until: endDate })
        });

        const formatRow = (data) => [
            data.date_start,
            data.date_stop,
            safeValue(data.adset_id, ''),
            safeValue(data.adset_name, ''),
            safeValue(data.campaign_id, ''),
            safeValue(data.campaign_name, ''),
            safeValue(data.objective, ''),
            safeValue(data.buying_type, ''),
            safeValue(data.optimization_goal, ''),
            safeValue(data.bid_strategy, ''),
            safeValue(data.daily_budget, ''),
            safeValue(data.lifetime_budget, ''),
            safeValue(data.budget_remaining, ''),
            safeValue(data.start_time, ''),
            safeValue(data.end_time, ''),
            ...buildMetricsRow(data)
        ];

        // Group raw rows by month tab
        const tabGroups = {};
        for (const row of insights) {
            const tab = getTabName('AdSets', row.date_start);
            if (!tabGroups[tab]) tabGroups[tab] = [];
            tabGroups[tab].push(row);
        }

        let totalAdded = 0;
        for (const [tab, rows] of Object.entries(tabGroups)) {
            totalAdded += await appendToSheet(sheetsClient, tab, ADSET_HEADERS, formatRow, rows);
        }

        return res.status(200).json({
            status: 'success',
            date_range: { start: startDate, end: endDate },
            tabs_updated: Object.keys(tabGroups).length,
            rows_added: totalAdded
        });
    } catch (err) {
        console.error('adsets sync error:', err);
        return res.status(500).json({ error: err.message });
    }
}
