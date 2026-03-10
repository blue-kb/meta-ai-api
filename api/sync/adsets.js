import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeDivide } from '../utils.js';

export default async function handler(req, res) {
    try {
        const sheetsClient = await getSheetsClient();

        const fields = [
            'adset_id', 'adset_name', 'campaign_id', 'campaign_name', 'spend', 'impressions',
            'reach', 'clicks', 'inline_link_clicks', 'inline_link_click_ctr', 'cpm', 'cpc',
            'frequency', 'actions', 'action_values'
        ];

        // Fetch adset level data
        const insights = await fetchMetaInsights('adset', fields);

        const formatRow = (data) => {
            const spend = parseFloat(data.spend) || 0;

            const purchases = parseMetaAction(data.actions, 'purchase') || parseMetaAction(data.actions, 'offsite_conversion.fb_pixel_purchase');
            const purchaseValue = parseMetaAction(data.action_values, 'purchase') || parseMetaAction(data.action_values, 'offsite_conversion.fb_pixel_purchase');
            const subscribes = parseMetaAction(data.actions, 'subscribe');
            const subscribeValue = parseMetaAction(data.action_values, 'subscribe');
            const addToCart = parseMetaAction(data.actions, 'add_to_cart');
            const initiateCheckout = parseMetaAction(data.actions, 'initiate_checkout');

            return [
                getYesterdayDateString(), // A: date
                data.adset_id, // B: adset_id
                data.adset_name, // C: adset_name
                data.campaign_id, // D: campaign_id
                data.campaign_name, // E: campaign_name
                '', // F: status
                '', // G: targeting_type
                '', // H: optimization_goal
                '', // I: bid_strategy
                0, // J: bid_amount
                0, // K: daily_budget
                spend, // L: spend
                data.impressions || 0, // M: impressions
                data.reach || 0, // N: reach
                data.clicks || 0, // O: clicks
                data.inline_link_clicks || 0, // P: link_clicks
                data.inline_link_click_ctr || 0, // Q: ctr
                data.cpm || 0, // R: cpm
                data.cpc || safeDivide(spend, data.inline_link_clicks), // S: cpc
                data.frequency || 0, // T: frequency
                purchases, // U: purchases
                purchaseValue, // V: purchase_value
                safeDivide(purchaseValue, spend), // W: purchase_roas
                safeDivide(spend, purchases), // X: cost_per_purchase
                subscribes, // Y: subscribes
                safeDivide(spend, subscribes), // Z: cost_per_subscribe
                subscribeValue, // AA: subscribe_value
                addToCart, // AB: add_to_cart
                initiateCheckout, // AC: initiate_checkout
                purchases, // AD: conversions_7d (simplified)
                '', // AE: learning_phase_status
                0, // AF: audience_size_min
                0 // AG: audience_size_max
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
