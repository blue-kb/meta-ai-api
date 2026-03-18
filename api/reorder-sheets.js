import { getSheetsClient } from './utils.js';

const LEVEL_ORDER = { 'Account': 0, 'Campaigns': 1, 'AdSets': 2, 'Ads': 3 };

function parseTabName(title) {
    const m = title.match(/^(Account|Campaigns|AdSets|Ads)_(\d{4})-(\d{2})$/);
    return m ? { level: m[1], year: parseInt(m[2]), month: parseInt(m[3]) } : null;
}

// Higher score = should appear earlier (more recent month, lower level index)
function tabScore(title) {
    const p = parseTabName(title);
    if (!p) return -Infinity;
    return p.year * 10000 + p.month * 10 - (LEVEL_ORDER[p.level] ?? 9);
}

export default async function handler(req, res) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) return res.status(500).json({ error: 'Missing GOOGLE_SHEET_ID' });

    try {
        const sheets = await getSheetsClient();
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const allSheets = spreadsheet.data.sheets;

        // Sort: highest score (most recent month, Account first) → index 0
        const sorted = [...allSheets].sort((a, b) =>
            tabScore(b.properties.title) - tabScore(a.properties.title)
        );

        // Build one updateSheetProperties request per sheet to set its new index
        const requests = sorted.map((sheet, index) => ({
            updateSheetProperties: {
                properties: { sheetId: sheet.properties.sheetId, index },
                fields: 'index',
            }
        }));

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        });

        res.json({
            status: 'ok',
            order: sorted.map(s => s.properties.title)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
