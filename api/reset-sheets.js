import { getSheetsClient, wipeAndResetHeaders } from './utils.js';

export default async function handler(req, res) {
    // Basic security check
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const sheetsClient = await getSheetsClient();
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;

        const metadata = await sheetsClient.spreadsheets.get({ spreadsheetId });
        const tabs = metadata.data.sheets.map(s => s.properties.title);

        const headerConfigs = {
            'Account': [
                'Date', 'Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks', 'CTR (%)', 'CPM', 'CPC', 'Frequency',
                'Purchases', 'Purchase Value', 'Purchase ROAS', 'Cost per Purchase', 'Subscribes',
                'Cost per Subscribe', 'Subscribe Value', 'Add to Cart', 'Initiate Checkout', 'Landing Page Views',
                'Video Views 3s', 'Video Views Thruplay', 'Budget in Learning %', 'Active Campaigns',
                'Active AdSets', 'Active Ads'
            ],
            'Campaigns': [
                'Date', 'Campaign ID', 'Campaign Name', 'Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks',
                'CTR (%)', 'CPM', 'CPC', 'Frequency', 'Purchases', 'Purchase Value', 'Purchase ROAS',
                'Cost per Purchase', 'Subscribes', 'Cost per Subscribe', 'Subscribe Value',
                'Add to Cart', 'Initiate Checkout', 'Video Views 3s', 'Video Views Thruplay'
            ],
            'AdSets': [
                'Date', 'AdSet ID', 'AdSet Name', 'Campaign ID', 'Campaign Name', 'Spend', 'Impressions',
                'Reach', 'Clicks', 'Link Clicks', 'CTR (%)', 'CPM', 'CPC', 'Frequency', 'Purchases',
                'Purchase Value', 'Purchase ROAS', 'Cost per Purchase', 'Subscribes',
                'Cost per Subscribe', 'Subscribe Value', 'Add to Cart', 'Initiate Checkout',
                'Video Views 3s', 'Video Views Thruplay'
            ],
            'Ads': [
                'Date', 'Ad ID', 'Ad Name', 'AdSet ID', 'AdSet Name', 'Campaign ID', 'Campaign Name',
                'Status', 'Creative Type', 'Spend', 'Impressions', 'Reach', 'Clicks', 'Link Clicks',
                'CTR (%)', 'CPM', 'CPC', 'Frequency', 'Purchases', 'Purchase Value', 'Purchase ROAS',
                'Cost per Purchase', 'Subscribes', 'Cost per Subscribe', 'Subscribe Value',
                'Add to Cart', 'Initiate Checkout', 'Video Play 25%', 'Video Play 50%',
                'Video Play 75%', 'Video Play 100%', 'Video Views 3s', 'Video Views Thruplay',
                'Hook Rate (%)', 'Hold Rate (%)', 'Days Running'
            ]
        };

        const results = [];
        for (const tab of tabs) {
            for (const [prefix, headers] of Object.entries(headerConfigs)) {
                if (tab.startsWith(prefix)) {
                    await wipeAndResetHeaders(sheetsClient, tab, headers);
                    results.push(`Reset ${tab}`);
                }
            }
        }

        return res.status(200).json({ status: 'ok', message: 'Sheets reset and headers initialized', details: results });
    } catch (error) {
        console.error('Reset error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
