import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeValue } from '../utils.js';

export default async function handler(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();
        const fields = [
            'campaign_id', 'campaign_name', 'spend', 'impressions', 'reach', 'clicks',
            'inline_link_clicks', 'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'actions', 'action_values', 'purchase_roas', 'cost_per_action_type'
        ];

        let startDate, endDate;
        if (req.query.start && req.query.end) {
            startDate = req.query.start;
            endDate = req.query.end;
        } else {
            const d = req.query.date || getYesterdayDateString();
            startDate = endDate = d;
        }

        const insights = await fetchMetaInsights('campaign', fields, {
            time_range: JSON.stringify({ since: startDate, until: endDate })
        });

        const headers = [
            'date', 'campaign_id', 'campaign_name', 'spend', 'impressions', 'reach', 'clicks',
            'inline_link_clicks', 'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'purchase', 'purchase_value', 'purchase_roas', 'cost_per_purchase',
            'subscribe', 'cost_per_subscribe', 'subscribe_value',
            'add_to_cart', 'initiate_checkout', 'video_view', 'thruplay'
        ];

        const formatRow = (data) => {
            const purchases = parseMetaAction(data.actions, 'purchase') || parseMetaAction(data.actions, 'offsite_conversion.fb_pixel_purchase');
            const purchaseValue = parseMetaAction(data.action_values, 'purchase') || parseMetaAction(data.action_values, 'offsite_conversion.fb_pixel_purchase');
            const subscribes = parseMetaAction(data.actions, 'subscribe');
            const subscribeValue = parseMetaAction(data.action_values, 'subscribe');
            const addToCart = parseMetaAction(data.actions, 'add_to_cart');
            const initiateCheckout = parseMetaAction(data.actions, 'initiate_checkout');
            const v3s = parseMetaAction(data.actions, 'video_view');
            const thruplay = parseMetaAction(data.actions, 'thruplay');
            return [
                data.date_start,
                safeValue(data.campaign_id, ''),
                safeValue(data.campaign_name, ''),
                safeValue(data.spend),
                safeValue(data.impressions),
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
                v3s,
                thruplay
            ];
        };

        const byTab = {};
        for (const row of insights) {
            const tabName = getTabName('Campaigns', row.date_start);
            if (!byTab[tabName]) byTab[tabName] = [];
            byTab[tabName].push(row);
        }

        let totalAdded = 0;
        for (const [tabName, rows] of Object.entries(byTab)) {
            totalAdded += await appendToSheet(sheetsClient, tabName, headers, formatRow, rows);
        }

        return res.status(200).json({ status: 'ok', level: 'campaigns', rows_added: totalAdded });
    } catch (error) {
        console.error('Campaigns sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
