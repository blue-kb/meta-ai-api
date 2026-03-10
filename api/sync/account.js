import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeDivide } from '../utils.js';

export default async function handler(req, res) {
    try {
        const sheetsClient = await getSheetsClient();

        const fields = [
            'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
            'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'actions', 'action_values'
        ];

        const dateOverride = req.query.date; // YYYY-MM-DD
        const targetDate = dateOverride || getYesterdayDateString();

        // Fetch account level data
        const insights = await fetchMetaInsights('account', fields, {
            time_range: JSON.stringify({ 'since': targetDate, 'until': targetDate })
        });
        const rowData = insights[0] || {};

        const spend = parseFloat(rowData.spend) || 0;

        // Parse actions
        const purchases = parseMetaAction(rowData.actions, 'purchase') || parseMetaAction(rowData.actions, 'offsite_conversion.fb_pixel_purchase');
        const purchaseValue = parseMetaAction(rowData.action_values, 'purchase') || parseMetaAction(rowData.action_values, 'offsite_conversion.fb_pixel_purchase');
        const subscribes = parseMetaAction(rowData.actions, 'subscribe');
        const subscribeValue = parseMetaAction(rowData.action_values, 'subscribe');
        const addToCart = parseMetaAction(rowData.actions, 'add_to_cart');
        const initiateCheckout = parseMetaAction(rowData.actions, 'initiate_checkout');
        const landingPageViews = parseMetaAction(rowData.actions, 'landing_page_view');
        const videoViews3s = parseMetaAction(rowData.actions, 'video_view');
        const videoViewsThruplay = parseMetaAction(rowData.actions, 'thruplay');

        // Format to matches schema
        const formatRow = (data) => [
            targetDate, // A: date (YYYY-MM-DD)
            spend, // B: spend
            safeValue(data.impressions), // C: impressions
            safeValue(data.reach), // D: reach
            safeValue(data.clicks), // E: clicks
            safeValue(data.inline_link_clicks), // F: link_clicks
            safeValue(data.inline_link_click_ctr), // G: ctr
            safeValue(data.cpm), // H: cpm
            safeValue(data.cpc), // I: cpc
            safeValue(data.frequency), // J: frequency
            purchases, // K: purchases
            purchaseValue, // L: purchase_value
            safeValue(rowData.purchase_roas?.[0]?.value), // M: purchase_roas (alt calc)
            safeValue(rowData.cost_per_purchase?.[0]?.value), // N: cost_per_purchase
            subscribes, // O: subscribes
            safeValue(rowData.cost_per_action_type?.find(a => a.action_type === 'subscribe')?.value), // P: cost_per_subscribe
            subscribeValue, // Q: subscribe_value
            addToCart, // R: add_to_cart
            initiateCheckout, // S: initiate_checkout
            landingPageViews, // T: landing_page_views
            videoViews3s, // U: video_views_3s
            videoViewsThruplay, // V: video_views_thruplay
            0, // W: budget_in_learning_pct (requires more nodes)
            0, // X: active_campaigns
            0, // Y: active_adsets
            0 // Z: active_ads
        ];

        const tabName = getTabName('Account');
        const headers = [
            'Date', 'Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks', 'CTR (%)', 'CPM', 'CPC', 'Frequency',
            'Purchases', 'Purchase Value', 'Purchase ROAS', 'Cost per Purchase', 'Subscribes',
            'Cost per Subscribe', 'Subscribe Value', 'Add to Cart', 'Initiate Checkout', 'Landing Page Views',
            'Video Views 3s', 'Video Views Thruplay', 'Budget in Learning %', 'Active Campaigns',
            'Active AdSets', 'Active Ads'
        ];

        const added = await appendToSheet(sheetsClient, tabName, headers, formatRow, [rowData]);

        return res.status(200).json({ status: 'ok', level: 'account', rows_added: added });
    } catch (error) {
        console.error('Account sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
