import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeDivide, safeValue } from '../utils.js';

export default async function handler(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();
        const fields = [
            'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
            'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'actions', 'action_values', 'purchase_roas', 'cost_per_action_type'
        ];

        // Support ?date=YYYY-MM-DD (single) or ?start=...&end=... (range)
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

        const headers = [
            'date', 'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
            'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'purchase', 'purchase_value', 'purchase_roas', 'cost_per_purchase',
            'subscribe', 'cost_per_subscribe', 'subscribe_value',
            'add_to_cart', 'initiate_checkout', 'landing_page_view',
            'video_view', 'thruplay', 'budget_in_learning_pct',
            'active_campaigns', 'active_adsets', 'active_ads'
        ];

        const formatRow = (data) => {
            const spend = parseFloat(data.spend) || 0;
            const purchases = parseMetaAction(data.actions, 'purchase') || parseMetaAction(data.actions, 'offsite_conversion.fb_pixel_purchase');
            const purchaseValue = parseMetaAction(data.action_values, 'purchase') || parseMetaAction(data.action_values, 'offsite_conversion.fb_pixel_purchase');
            const subscribes = parseMetaAction(data.actions, 'subscribe');
            const subscribeValue = parseMetaAction(data.action_values, 'subscribe');
            const addToCart = parseMetaAction(data.actions, 'add_to_cart');
            const initiateCheckout = parseMetaAction(data.actions, 'initiate_checkout');
            const landingPageViews = parseMetaAction(data.actions, 'landing_page_view');
            const videoViews3s = parseMetaAction(data.actions, 'video_view');
            const videoViewsThruplay = parseMetaAction(data.actions, 'thruplay');
            return [
                data.date_start,
                spend,
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
                landingPageViews,
                videoViews3s,
                videoViewsThruplay,
                0, 0, 0, 0
            ];
        };

        // Group by tab (month) in case date range spans months
        const byTab = {};
        for (const row of insights) {
            const tabName = getTabName('Account', row.date_start);
            if (!byTab[tabName]) byTab[tabName] = [];
            byTab[tabName].push(row);
        }

        let totalAdded = 0;
        for (const [tabName, rows] of Object.entries(byTab)) {
            totalAdded += await appendToSheet(sheetsClient, tabName, headers, formatRow, rows);
        }

        return res.status(200).json({ status: 'ok', level: 'account', rows_added: totalAdded });
    } catch (error) {
        console.error('Account sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
