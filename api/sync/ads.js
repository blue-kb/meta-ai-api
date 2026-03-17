import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, AD_HEADERS, COMMON_INSIGHT_FIELDS, buildMetricsRow, safeValue, parseMetaAction } from '../utils.js';

export default async function handler(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();
        const fields = [
            ...COMMON_INSIGHT_FIELDS,
            'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
            'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
            'video_play_actions',
            'video_p25_watched_actions',
            'video_p50_watched_actions',
            'video_p75_watched_actions',
            'video_p100_watched_actions',
            'video_30_sec_watched_actions',
            'video_thruplay_watched_actions',
            'video_avg_time_watched_actions',
            'video_continuous_2_sec_watched_actions',
            'canvas_avg_view_time',
            'canvas_avg_view_percent'
        ];

        let startDate, endDate;
        if (req.query.start && req.query.end) {
            startDate = req.query.start;
            endDate = req.query.end;
        } else {
            const d = req.query.date || getYesterdayDateString();
            startDate = endDate = d;
        }

        const insights = await fetchMetaInsights('ad', fields, {
            time_range: JSON.stringify({ since: startDate, until: endDate })
        });

        const formatRow = (data) => [
            data.date_start,
            data.date_stop,
            safeValue(data.ad_id, ''),
            safeValue(data.ad_name, ''),
            safeValue(data.adset_id, ''),
            safeValue(data.adset_name, ''),
            safeValue(data.campaign_id, ''),
            safeValue(data.campaign_name, ''),
            safeValue(data.quality_ranking, ''),
            safeValue(data.engagement_rate_ranking, ''),
            safeValue(data.conversion_rate_ranking, ''),
            ...buildMetricsRow(data),
            parseMetaAction(data.video_play_actions, 'video_view'),
            parseMetaAction(data.video_p25_watched_actions, 'video_view'),
            parseMetaAction(data.video_p50_watched_actions, 'video_view'),
            parseMetaAction(data.video_p75_watched_actions, 'video_view'),
            parseMetaAction(data.video_p100_watched_actions, 'video_view'),
            parseMetaAction(data.video_30_sec_watched_actions, 'video_view'),
            parseMetaAction(data.video_thruplay_watched_actions, 'video_view'),
            parseMetaAction(data.video_avg_time_watched_actions, 'video_view'),
            parseMetaAction(data.video_continuous_2_sec_watched_actions, 'video_view'),
            safeValue(data.canvas_avg_view_time, ''),
            safeValue(data.canvas_avg_view_percent, '')
        ];

        // Group rows by month tab
        const tabGroups = {};
        for (const row of insights) {
            const tab = getTabName('Ads', row.date_start);
            if (!tabGroups[tab]) tabGroups[tab] = [];
            tabGroups[tab].push(formatRow(row));
        }

        // Collect all target dates for dedup
        const targetDates = new Set();
        const d = new Date(startDate);
        const end = new Date(endDate);
        while (d <= end) {
            targetDates.add(d.toISOString().slice(0, 10));
            d.setDate(d.getDate() + 1);
        }

        const results = [];
        for (const [tab, rows] of Object.entries(tabGroups)) {
            const result = await appendToSheet(sheetsClient, tab, rows, AD_HEADERS, targetDates);
            results.push({ tab, rows_written: rows.length, ...result });
        }

        return res.status(200).json({
            status: 'success',
            date_range: { start: startDate, end: endDate },
            tabs_updated: results.length,
            results
        });
    } catch (err) {
        console.error('ads sync error:', err);
        return res.status(500).json({ error: err.message });
    }
}
