import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeDivide } from '../utils.js';

export default async function handler(req, res) {
    try {
        const sheetsClient = await getSheetsClient();

        // Ads require specific video fields
        const fields = [
            'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
            'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
            'inline_link_click_ctr', 'cpm', 'cpc', 'frequency',
            'actions', 'action_values', 'video_p25_watched_actions', 'video_p50_watched_actions',
            'video_p75_watched_actions', 'video_p100_watched_actions'
        ];

        // Fetch ad level data
        const insights = await fetchMetaInsights('ad', fields);

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

            // Calculate Hook Rate & Hold Rate
            const hookRate = safeDivide(videoViews3s, impressions) * 100;
            const holdRate = safeDivide(videoViewsThruplay, videoViews3s) * 100;

            return [
                getYesterdayDateString(), // A: date
                data.ad_id, // B: ad_id
                data.ad_name, // C: ad_name
                data.adset_id, // D: adset_id
                data.adset_name, // E: adset_name
                data.campaign_id, // F: campaign_id
                data.campaign_name, // G: campaign_name
                '', // H: status
                '', // I: creative_type
                spend, // J: spend
                impressions, // K: impressions
                data.reach || 0, // L: reach
                data.clicks || 0, // M: clicks
                data.inline_link_clicks || 0, // N: link_clicks
                data.inline_link_click_ctr || 0, // O: ctr
                data.cpm || 0, // P: cpm
                data.cpc || safeDivide(spend, data.inline_link_clicks), // Q: cpc
                data.frequency || 0, // R: frequency
                purchases, // S: purchases
                purchaseValue, // T: purchase_value
                safeDivide(purchaseValue, spend), // U: purchase_roas
                safeDivide(spend, purchases), // V: cost_per_purchase
                subscribes, // W: subscribes
                safeDivide(spend, subscribes), // X: cost_per_subscribe
                subscribeValue, // Y: subscribe_value
                addToCart, // Z: add_to_cart
                initiateCheckout, // AA: initiate_checkout
                safeDivide(v25, impressions) * 100, // AB: video_play_pct_25
                safeDivide(v50, impressions) * 100, // AC: video_play_pct_50
                safeDivide(v75, impressions) * 100, // AD: video_play_pct_75
                safeDivide(v100, impressions) * 100, // AE: video_play_pct_100
                videoViews3s, // AF: video_views_3s
                videoViewsThruplay, // AG: video_views_thruplay
                hookRate, // AH: hook_rate
                holdRate, // AI: hold_rate
                1 // AJ: days_running (Needs to fetch Ad creation_time, defaulting to 1 for lightweight)
            ];
        };

        const tabName = getTabName('Ads');
        const headers = [
            'date', 'ad_id', 'ad_name', 'adset_id', 'adset_name', 'campaign_id', 'campaign_name',
            'status', 'creative_type', 'spend', 'impressions', 'reach', 'clicks', 'link_clicks',
            'ctr', 'cpm', 'cpc', 'frequency', 'purchases', 'purchase_value', 'purchase_roas',
            'cost_per_purchase', 'subscribes', 'cost_per_subscribe', 'subscribe_value',
            'add_to_cart', 'initiate_checkout', 'video_play_pct_25', 'video_play_pct_50',
            'video_play_pct_75', 'video_play_pct_100', 'video_views_3s', 'video_views_thruplay',
            'hook_rate', 'hold_rate', 'days_running'
        ];

        const added = await appendToSheet(sheetsClient, tabName, headers, formatRow, insights);

        return res.status(200).json({ status: 'ok', level: 'ads', rows_added: added });
    } catch (error) {
        console.error('Ads sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
