import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeDivide, safeValue } from '../utils.js';

export default async function handler(req, res) {
    // Security check
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();

        const fields = [
            'campaign_id', 'campaign_name', 'spend', 'impressions', 'reach', 'clicks',
            'inline_link_clicks', 'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'actions', 'action_values'
        ];

        const dateOverride = req.query.date; // YYYY-MM-DD
        const targetDate = dateOverride || getYesterdayDateString();

        // Fetch campaign level data
        const insights = await fetchMetaInsights('campaign', fields, {
            time_range: JSON.stringify({ 'since': targetDate, 'until': targetDate })
        });

        const formatRow = (data) => {
            const spend = parseFloat(data.spend) || 0;
            const purchases = parseMetaAction(data.actions, 'purchase') || parseMetaAction(data.actions, 'offsite_conversion.fb_pixel_purchase');
            const purchaseValue = parseMetaAction(data.action_values, 'purchase') || parseMetaAction(data.action_values, 'offsite_conversion.fb_pixel_purchase');
            const subscribes = parseMetaAction(data.actions, 'subscribe');
            const subscribeValue = parseMetaAction(data.action_values, 'subscribe');
            const addToCart = parseMetaAction(data.actions, 'add_to_cart');
            const initiateCheckout = parseMetaAction(data.actions, 'initiate_checkout');
            const v3s = parseMetaAction(data.actions, 'video_view');
            const thruplay = parseMetaAction(data.actions, 'thruplay');

            return [
                targetDate, // A: date (YYYY-MM-DD)
                safeValue(data.campaign_id, ''), // B: campaign_id
                safeValue(data.campaign_name, ''), // C: campaign_name
                safeValue(data.spend), // D: spend
                safeValue(data.impressions), // E: impressions
                safeValue(data.reach), // F: reach
                safeValue(data.clicks), // G: clicks
                safeValue(data.inline_link_clicks), // H: link_clicks
                safeValue(data.inline_link_click_ctr), // I: ctr
                safeValue(data.cpm), // J: cpm
                safeValue(data.cpc), // K: cpc
                safeValue(data.frequency), // L: frequency
                purchases, // M: purchases
                purchaseValue, // N: purchase_value
                safeValue(data.purchase_roas?.[0]?.value), // O: purchase_roas
                safeValue(data.cost_per_purchase?.[0]?.value), // P: cost_per_purchase
                subscribes, // Q: subscribes
                safeValue(data.cost_per_action_type?.find(a => a.action_type === 'subscribe')?.value), // R: cost_per_subscribe
                subscribeValue, // S: subscribe_value
                addToCart, // T: add_to_cart
                initiateCheckout, // U: initiate_checkout
                v3s, // V: video_views_3s
                thruplay // W: video_views_thruplay
            ];
        };

        const tabName = getTabName('Campaigns', targetDate);
        const headers = [
            'Date', 'Campaign ID', 'Campaign Name', 'Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks',
            'CTR (%)', 'CPM', 'CPC', 'Frequency', 'Purchases', 'Purchase Value', 'Purchase ROAS',
            'Cost per Purchase', 'Subscribes', 'Cost per Subscribe', 'Subscribe Value',
            'Add to Cart', 'Initiate Checkout', 'Video Views 3s', 'Video Views Thruplay'
        ];

        const added = await appendToSheet(sheetsClient, tabName, headers, formatRow, insights);

        return res.status(200).json({ status: 'ok', level: 'campaigns', rows_added: added });
    } catch (error) {
        console.error('Campaigns sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
