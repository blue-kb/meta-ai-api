import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, ACCOUNT_HEADERS, COMMON_INSIGHT_FIELDS, buildMetricsRow, safeValue } from '../utils.js';

export default async function handler(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();
        const fields = [...COMMON_INSIGHT_FIELDS, 'account_name'];

        let startDate, endDate;
        if (req.query.start && req.query.end) {
            startDate = req.query.start;
            endDate = req.query.end;
        } else {
            const d = req.query.date || getYesterdayDateString();
            startDate = endDate = d;
        }

        const insights = await fetchMetaInsights('account', fields, {
            time_range: JSON.stringify({ since: startDate, until: endDate })
        });

        const formatRow = (data) => [
            data.date_start,
            data.date_stop,
            process.env.META_ACCOUNT_ID || safeValue(data.account_id, ''),
            safeValue(data.account_name, ''),
            ...buildMetricsRow(data)
        ];

        const byTab = {};
        for (const row of insights) {
            const tabName = getTabName('Account', row.date_start);
            if (!byTab[tabName]) byTab[tabName] = [];
            byTab[tabName].push(row);
        }

        let totalAdded = 0;
        for (const [tabName, rows] of Object.entries(byTab)) {
            totalAdded += await appendToSheet(sheetsClient, tabName, ACCOUNT_HEADERS, formatRow, rows);
        }

        return res.status(200).json({ status: 'ok', level: 'account', rows_added: totalAdded });
    } catch (error) {
        console.error('Account sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
