import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeDivide } from '../utils.js';

export default async function handler(req, res) {
    // Security check
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();

        const fields = [
            'adset_id', 'adset_name', 'campaign_id', 'campaign_name', 'spend', 'impressions',
            'reach', 'clicks', 'inline_link_clicks', 'inline_link_click_ctr', 'cpm', 'cpc',
            'frequency', 'actions', 'action_values'
        ];

        const dateOverride = req.query.date; // YYYY-MM-DD
        const targetDate = dateOverride || getYesterdayDateString();

        // Fetch adset level data
        const insights = await fetchMetaInsights('adset', fields, {
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
                safeValue(data.adset_id, ''), // B: adset_id
                safeValue(data.adset_name, ''), // C: adset_name
                safeValue(data.campaign_id, ''), // D: campaign_id
                safeValue(data.campaign_name, ''), // E: campaign_name
                safeValue(data.spend), // F: spend
                safeValue(data.impressions), // G: impressions
                safeValue(data.reach), // H: reach
                safeValue(data.clicks), // I: clicks
                safeValue(data.inline_link_clicks), // J: link_clicks
                safeValue(data.inline_link_click_ctr), // K: ctr
                safeValue(data.cpm), // L: cpm
                safeValue(data.cpc), // M: cpc
                safeValue(data.frequency), // N: frequency
                purchases, // O: purchases
                purchaseValue, // P: purchase_value
                safeValue(data.purchase_roas?.[0]?.value), // Q: purchase_roas
                safeValue(data.cost_per_purchase?.[0]?.value), // R: cost_per_purchase
                subscribes, // S: subscribes
                safeValue(data.cost_per_action_type?.find(a => a.action_type === 'subscribe')?.value), // T: cost_per_subscribe
                subscribeValue, // U: subscribe_value
                addToCart, // V: add_to_cart
                initiateCheckout, // W: initiate_checkout
                v3s, // X: video_views_3s
                thruplay // Y: video_views_thruplay
            ];
        };

        const tabName = getTabName('AdSets');
        const headers = [
            'Date', 'AdSet ID', 'AdSet Name', 'Campaign ID', 'Campaign Name', 'Spend', 'Impressions',
            'Reach', 'Clicks', 'Link Clicks', 'CTR (%)', 'CPM', 'CPC', 'Frequency', 'Purchases',
            'Purchase Value', 'Purchase ROAS', 'Cost per Purchase', 'Subscribes',
            'Cost per Subscribe', 'Subscribe Value', 'Add to Cart', 'Initiate Checkout',
            'Video Views 3s', 'Video Views Thruplay'
        ];

        const added = await appendToSheet(sheetsClient, tabName, headers, formatRow, insights);

        return res.status(200).json({ status: 'ok', level: 'adsets', rows_added: added });
    } catch (error) {
        console.error('AdSets sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
