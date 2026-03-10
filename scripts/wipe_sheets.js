import { getSheetsClient } from '../api/utils.js';
import dotenv from 'dotenv';
dotenv.config();

async function reset() {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
        throw new Error('GOOGLE_SHEET_ID environment variable is missing');
    }

    const metadata = await sheets.spreadsheets.get({ spreadsheetId });
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

    for (const tab of tabs) {
        let matched = false;
        for (const [prefix, headers] of Object.entries(headerConfigs)) {
            if (tab.startsWith(prefix)) {
                matched = true;
                console.log(`Wiping and re-headering ${tab}...`);

                // 1. Clear the entire sheet
                await sheets.spreadsheets.values.clear({
                    spreadsheetId,
                    range: `${tab}!A:Z`
                });

                // 2. Set Row 1 with headers
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${tab}!A1`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [headers] }
                });
                break;
            }
        }
        if (!matched) {
            console.log(`Skipping tab ${tab} (no header config matched)`);
        }
    }
    console.log('Google Sheets reset successfully.');
}

reset().catch(console.error);
