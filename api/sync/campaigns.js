import { getSheetsClient, fetchMetaInsights, fetchEffectiveStatuses, mapDelivery, getTabName, getYesterdayDateString, appendToSheet, CAMPAIGN_HEADERS, COMMON_INSIGHT_FIELDS, buildMetricsRow, safeValue } from '../utils.js';

export default async function handler(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();
        const fields = [...COMMON_INSIGHT_FIELDS, 'campaign_id', 'campaign_name', 'objective', 'buying_type'];

        let startDate, endDate;
        if (req.query.start && req.query.end) {
            startDate = req.query.start;
            endDate = req.query.end;
        } else {
            const d = req.query.date || getYesterdayDateString();
            startDate = endDate = d;
        }

        const [insights, statusMap] = await Promise.all([
            fetchMetaInsights('campaign', fields, {
                time_range: JSON.stringify({ since: startDate, until: endDate })
            }),
            fetchEffectiveStatuses('campaign')
        ]);

        const formatRow = (data) => [
            data.date_start,
            data.date_stop,
            safeValue(data.campaign_id, ''),
            safeValue(data.campaign_name, ''),
            mapDelivery(statusMap.get(data.campaign_id)),
            safeValue(data.objective, ''),
            safeValue(data.buying_type, ''),
            ...buildMetricsRow(data)
        ];

        // Group raw rows by month tab
        const tabGroups = {};
        for (const row of insights) {
            const tab = getTabName('Campaigns', row.date_start);
            if (!tabGroups[tab]) tabGroups[tab] = [];
            tabGroups[tab].push(row);
        }

        let totalAdded = 0;
        for (const [tab, rows] of Object.entries(tabGroups)) {
            totalAdded += await appendToSheet(sheetsClient, tab, CAMPAIGN_HEADERS, formatRow, rows);
        }

        return res.status(200).json({
            status: 'success',
            date_range: { start: startDate, end: endDate },
            tabs_updated: Object.keys(tabGroups).length,
            rows_added: totalAdded
        });
    } catch (err) {
        console.error('campaigns sync error:', err);
        return res.status(500).json({ error: err.message });
    }
}
