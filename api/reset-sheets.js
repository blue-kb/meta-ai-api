import { getSheetsClient, wipeAndResetHeaders, ACCOUNT_HEADERS, CAMPAIGN_HEADERS, ADSET_HEADERS, AD_HEADERS } from './utils.js';

export default async function handler(req, res) {
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
            'Account': ACCOUNT_HEADERS,
            'Campaigns': CAMPAIGN_HEADERS,
            'AdSets': ADSET_HEADERS,
            'Ads': AD_HEADERS
        };

        const results = [];
        for (const tab of tabs) {
            for (const [prefix, headers] of Object.entries(headerConfigs)) {
                if (tab.startsWith(prefix + '_') || tab === prefix) {
                    await wipeAndResetHeaders(sheetsClient, tab, headers);
                    results.push(`Reset ${tab} (${headers.length} columns)`);
                }
            }
        }

        return res.status(200).json({ status: 'ok', message: 'Sheets reset with comprehensive headers', details: results });
    } catch (error) {
        console.error('Reset error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
