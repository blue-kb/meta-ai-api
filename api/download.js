import { getSheetsClient } from './utils.js';

export default async function handler(req, res) {
    const { tabs } = req.query;

    if (!tabs) {
        return res.status(400).json({ error: 'No tabs specified' });
    }

    const tabNames = tabs.split(',').map(t => t.trim()).filter(Boolean);
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
        return res.status(500).json({ error: 'Missing GOOGLE_SHEET_ID env var' });
    }

    try {
        const sheets = await getSheetsClient();
        const csvParts = [];

        for (const tabName of tabNames) {
            let rows;
            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: tabName,
                });
                rows = response.data.values || [];
            } catch (e) {
                // Tab doesn't exist — skip silently
                continue;
            }

            if (rows.length === 0) continue;

            // Section header when exporting multiple tabs
            if (tabNames.length > 1) {
                csvParts.push(`# ${tabName}`);
            }

            for (const row of rows) {
                const csvRow = row.map(cell => {
                    const str = String(cell ?? '');
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                }).join(',');
                csvParts.push(csvRow);
            }

            if (tabNames.length > 1) csvParts.push('');
        }

        if (csvParts.length === 0) {
            return res.status(404).json({ error: 'No data found for the selected tabs' });
        }

        const csvContent = '\uFEFF' + csvParts.join('\n'); // BOM for Excel UTF-8
        const filename = tabNames.length === 1
            ? `${tabNames[0]}.csv`
            : `meta_ads_export_${new Date().toISOString().split('T')[0]}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csvContent);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
