import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeDivide } from '../utils.js';

export default async function handler(req, res) {
    try {
        const sheetsClient = await getSheetsClient();

        const fields = [
            'campaign_id', 'campaign_name', 'spend', 'impressions', 'reach', 'clicks',
            'inline_link_clicks', 'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'actions', 'action_values'
        ];

        // Fetch campaign level data
        const insights = await fetchMetaInsights('campaign', fields);

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
                data.campaign_id, // B: campaign_id
                data.campaign_name, // C: campaign_name
                '', // D: objective (requires fetching raw campaign node, skipping for speed)
                '', // E: status
                '', // F: buying_type
                '', // G: budget_type
                0, // H: daily_budget
                spend, // I: spend
                data.impressions || 0, // J: impressions
                data.reach || 0, // K: reach
                data.clicks || 0, // L: clicks
                data.inline_link_clicks || 0, // M: link_clicks
                data.inline_link_click_ctr || 0, // N: ctr
                data.cpm || 0, // O: cpm
                data.cpc || safeDivide(spend, data.inline_link_clicks), // P: cpc
                data.frequency || 0, // Q: frequency
                purchases, // R: purchases
                purchaseValue, // S: purchase_value
                safeDivide(purchaseValue, spend), // T: purchase_roas
                safeDivide(spend, purchases), // U: cost_per_purchase
                subscribes, // V: subscribes
                safeDivide(spend, subscribes), // W: cost_per_subscribe
                subscribeValue, // X: subscribe_value
                addToCart, // Y: add_to_cart
                initiateCheckout, // Z: initiate_checkout
                '', // AA: learning_phase_status
                0 // AB: budget_split_pct (requires knowing total account spend, handled in Sheets if needed)
            ];
        };

        const tabName = getTabName('Campaigns');
        const headers = [
            'date', 'campaign_id', 'campaign_name', 'objective', 'status', 'buying_type',
            'budget_type', 'daily_budget', 'spend', 'impressions', 'reach', 'clicks', 'link_clicks',
            'ctr', 'cpm', 'cpc', 'frequency', 'purchases', 'purchase_value', 'purchase_roas',
            'cost_per_purchase', 'subscribes', 'cost_per_subscribe', 'subscribe_value',
            'add_to_cart', 'initiate_checkout', 'learning_phase_status', 'budget_split_pct'
        ];

        const added = await appendToSheet(sheetsClient, tabName, headers, formatRow, insights);

        return res.status(200).json({ status: 'ok', level: 'campaigns', rows_added: added });
    } catch (error) {
        console.error('Campaigns sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
