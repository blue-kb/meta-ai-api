import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeDivide, safeValue } from '../utils.js';

export default async function handler(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();
        const fields = [
            'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
            'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
            'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'actions', 'action_values', 'purchase_roas', 'cost_per_action_type',
            'video_p25_watched_actions', 'video_p50_watched_actions',
            'video_p75_watched_actions', 'video_p100_watched_actions'
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

        console.log(`[Ads Sync] Fetched ${insights.length} ad rows for ${startDate} to ${endDate}`);

        const headers = [
            'date', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
            'status', 'creative_type', 'spend', 'impressions', 'reach', 'clicks',
            'inline_link_clicks', 'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'purchase', 'purchase_value', 'purchase_roas', 'cost_per_purchase',
            'subscribe', 'cost_per_subscribe', 'subscribe_value',
            'add_to_cart', 'initiate_checkout',
            'video_p25_watched_actions', 'video_p50_watched_actions',
            'video_p75_watched_actions', 'video_p100_watched_actions',
            'video_view', 'thruplay', 'hook_rate', 'hold_rate', 'days_running'
        ];

        const formatRow = (data) => {
            const spend = parseFloat(data.spend) || 0;
            const impressions = parseInt(data.impressions) || 0;
            const purchases = parseMetaAction(data.actions, 'purchase') || parseMetaAction(data.actions, 'offsite_conversion.fb_pixel_purchase');
            const purchaseValue = parseMetaAction(data.action_values, 'purchase') || parseMetaAction(data.action_values, 'offsite_conversion.fb_pixel_purchase');
            const subscribes = parseMetaAction(data.actions, 'subscribe');
            const subscribeValue = parseMetaAction(data.action_values, 'subscribe');
            const addToCart = parseMetaAction(data.actions, 'add_to_cart');
            const initiateCheckout = parseMetaAction(data.actions, 'initiate_checkout');
            const v25 = parseMetaAction(data.video_p25_watched_actions, 'video_view');
            const v50 = parseMetaAction(data.video_p50_watched_actions, 'video_view');
            const v75 = parseMetaAction(data.video_p75_watched_actions, 'video_view');
            const v100 = parseMetaAction(data.video_p100_watched_actions, 'video_view');
            const videoViews3s = parseMetaAction(data.actions, 'video_view');
            const videoViewsThruplay = parseMetaAction(data.actions, 'thruplay');
            const hookRate = safeDivide(videoViews3s, impressions) * 100;
            const holdRate = safeDivide(videoViewsThruplay, videoViews3s) * 100;
            return [
                data.date_start,
                safeValue(data.ad_id, ''),
                safeValue(data.ad_name, ''),
                safeValue(data.adset_id, ''),
                safeValue(data.adset_name, ''),
                safeValue(data.campaign_id, ''),
                safeValue(data.campaign_name, ''),
                '', '',
                spend,
                impressions,
                safeValue(data.reach),
                safeValue(data.clicks),
                safeValue(data.inline_link_clicks),
                safeValue(data.inline_link_click_ctr),
                safeValue(data.cpm),
                safeValue(data.cpc),
                safeValue(data.frequency),
                purchases,
                purchaseValue,
                safeValue(data.purchase_roas?.[0]?.value),
                safeValue(data.cost_per_action_type?.find(a => a.action_type === 'purchase')?.value),
                subscribes,
                safeValue(data.cost_per_action_type?.find(a => a.action_type === 'subscribe')?.value),
                subscribeValue,
                addToCart,
                initiateCheckout,
                safeDivide(v25, impressions) * 100,
                safeDivide(v50, impressions) * 100,
                safeDivide(v75, impressions) * 100,
                safeDivide(v100, impressions) * 100,
                videoViews3s,
                videoViewsThruplay,
                hookRate,
                holdRate,
                1
            ];
        };

        const byTab = {};
        for (const row of insights) {
            const tabName = getTabName('Ads', row.date_start);
            if (!byTab[tabName]) byTab[tabName] = [];
            byTab[tabName].push(row);
        }

        let totalAdded = 0;
        for (const [tabName, rows] of Object.entries(byTab)) {
            totalAdded += await appendToSheet(sheetsClient, tabName, headers, formatRow, rows);
        }

        return res.status(200).json({ status: 'ok', level: 'ads', rows_added: totalAdded });
    } catch (error) {
        console.error('Ads sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
