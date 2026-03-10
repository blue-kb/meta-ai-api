import { getSheetsClient, fetchMetaInsights, getTabName, getYesterdayDateString, appendToSheet, parseMetaAction, safeDivide, safeValue } from '../utils.js';

export default async function handler(req, res) {
    // Security check
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

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

        const dateOverride = req.query.date; // YYYY-MM-DD
        const targetDate = dateOverride || getYesterdayDateString();

        // Fetch ad level data
        const insights = await fetchMetaInsights('ad', fields, {
            time_range: JSON.stringify({ 'since': targetDate, 'until': targetDate })
        });

        console.log(`[Ads Sync] Fetched ${insights.length} ads for ${targetDate}`);

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
                targetDate, // A: date (YYYY-MM-DD)
                safeValue(data.ad_id, ''), // B: ad_id
                safeValue(data.ad_name, ''), // C: ad_name
                safeValue(data.adset_id, ''), // D: adset_id
                safeValue(data.adset_name, ''), // E: adset_name
                safeValue(data.campaign_id, ''), // F: campaign_id
                safeValue(data.campaign_name, ''), // G: campaign_name
                '', // H: Status (N/A in insights)
                '', // I: Creative Type (N/A in insights)
                spend, // J: spend
                impressions, // K: impressions
                safeValue(data.reach), // L: reach
                safeValue(data.clicks), // M: clicks
                safeValue(data.inline_link_clicks), // N: link_clicks
                safeValue(data.inline_link_click_ctr), // O: ctr
                safeValue(data.cpm), // P: cpm
                safeValue(data.cpc), // Q: cpc
                safeValue(data.frequency), // R: frequency
                purchases, // S: purchases
                purchaseValue, // T: purchase_value
                safeValue(data.purchase_roas?.[0]?.value), // U: purchase_roas
                safeValue(data.cost_per_purchase?.[0]?.value), // V: cost_per_purchase
                subscribes, // W: subscribes
                safeValue(data.cost_per_action_type?.find(a => a.action_type === 'subscribe')?.value), // X: cost_per_subscribe
                subscribeValue, // Y: subscribe_value
                addToCart, // Z: add_to_cart
                initiateCheckout, // AA: initiate_checkout
                safeDivide(v25, impressions) * 100, // AB: Video Play 25%
                safeDivide(v50, impressions) * 100, // AC: Video Play 50%
                safeDivide(v75, impressions) * 100, // AD: Video Play 75%
                safeDivide(v100, impressions) * 100, // AE: Video Play 100%
                videoViews3s, // AF: Video Views 3s
                videoViewsThruplay, // AG: Video Views Thruplay
                hookRate, // AH: Hook Rate (%)
                holdRate, // AI: Hold Rate (%)
                1 // AJ: Days Running
            ];
        };

        const tabName = getTabName('Ads', targetDate);
        const headers = [
            'Date', 'Ad ID', 'Ad Name', 'AdSet ID', 'AdSet Name', 'Campaign ID', 'Campaign Name',
            'Status', 'Creative Type', 'Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks',
            'CTR (%)', 'CPM', 'CPC', 'Frequency', 'Purchases', 'Purchase Value', 'Purchase ROAS',
            'Cost per Purchase', 'Subscribes', 'Cost per Subscribe', 'Subscribe Value',
            'Add to Cart', 'Initiate Checkout', 'Video Play 25%', 'Video Play 50%',
            'Video Play 75%', 'Video Play 100%', 'Video Views 3s', 'Video Views Thruplay',
            'Hook Rate (%)', 'Hold Rate (%)', 'Days Running'
        ];

        const added = await appendToSheet(sheetsClient, tabName, headers, formatRow, insights);

        return res.status(200).json({ status: 'ok', level: 'ads', rows_added: added });
    } catch (error) {
        console.error('Ads sync error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
