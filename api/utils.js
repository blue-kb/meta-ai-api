import { google } from 'googleapis';

export async function getSheetsClient() {
    const accountKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!accountKeyStr) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');
    let credentials;
    try { credentials = JSON.parse(accountKeyStr); }
    catch (e) { throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON'); }
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
}

export async function fetchMetaInsights(level, fields, extraParams = {}) {
    const actId = process.env.META_ACCOUNT_ID;
    const token = process.env.META_ACCESS_TOKEN;
    if (!actId || !token) throw new Error('Missing META_ACCOUNT_ID or META_ACCESS_TOKEN');
    const url = `https://graph.facebook.com/v19.0/act_${actId}/insights`;
    const params = { access_token: token, level, fields: fields.join(','), time_increment: 1, limit: 500, ...extraParams };
    if (!params.time_range && !params.date_preset) params.date_preset = 'yesterday';
    let allData = [];
    let currentUrl = url;
    while (currentUrl) {
        let fetchUrl = currentUrl;
        if (currentUrl === url) {
            const queryParams = new URLSearchParams(params).toString();
            fetchUrl = `${url}?${queryParams}`;
        }
        const response = await fetch(fetchUrl);
        const data = await response.json();
        if (!response.ok) throw new Error(`Meta API error: ${data.error?.message || response.statusText}`);
        if (data.data && data.data.length > 0) allData = allData.concat(data.data);
        currentUrl = (data.paging && data.paging.next) ? data.paging.next : null;
    }
    return allData;
}

export function safeDivide(numerator, denominator) {
    return denominator > 0 ? (numerator / denominator) : 0;
}

export function getTabName(levelPrefix, referenceDateStr) {
    let date = referenceDateStr ? new Date(referenceDateStr) : new Date();
    if (!referenceDateStr) date.setDate(date.getDate() - 1);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${levelPrefix}_${year}-${month}`;
}

export function getDateString(date) { return date.toISOString().split('T')[0]; }

export function getYesterdayDateString() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return getDateString(date);
}

/**
 * Upsert rows for a specific date into a sheet tab, then sort all rows chronologically.
 * - Creates the tab if missing
 * - Always writes correct headers to row 1
 * - Removes existing rows for the same date (dedup)
 * - Merges + sorts all rows by date ascending (earliest first)
 */
export async function appendToSheet(sheetsClient, tabName, headers, formatRowFunc, metaData) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEET_ID');
    if (metaData.length === 0) return 0;

    // Format new rows
    const newRows = metaData.map(data => {
        const row = formatRowFunc(data);
        if (row[0] && typeof row[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row[0])) {
            row[0] = "'" + row[0];
        }
        return row;
    });

    const targetDate = String(newRows[0][0]).replace(/^'/, '');

    // Ensure tab exists
    const spreadsheet = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === tabName);
    if (!sheetExists) {
        await sheetsClient.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] }
        });
    }

    // Always write correct headers to row 1
    await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] }
    });

    // Read all existing data rows (row 2 onwards)
    const existing = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A2:ZZ`
    });

    // Remove rows matching targetDate (dedup)
    const keepRows = (existing.data.values || []).filter(row => {
        const cellDate = String(row[0] || '').replace(/^'/, '');
        return cellDate !== targetDate;
    });

    // Merge and sort ascending by date (earliest first)
    const allRows = [...keepRows, ...newRows];
    allRows.sort((a, b) => {
        const da = String(a[0] || '').replace(/^'/, '');
        const db = String(b[0] || '').replace(/^'/, '');
        return da.localeCompare(db);
    });

    // Clear data area and rewrite
    await sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: `${tabName}!A2:ZZ` });
    if (allRows.length > 0) {
        await sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range: `${tabName}!A2`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: allRows }
        });
    }

    return newRows.length;
}

export async function wipeAndResetHeaders(sheetsClient, tabName, headers) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEET_ID');
    await sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: `${tabName}!A:Z` });
    await sheetsClient.spreadsheets.values.update({
        spreadsheetId, range: `${tabName}!A1`, valueInputOption: 'RAW',
        requestBody: { values: [headers] }
    });
    return true;
}

export function parseMetaAction(actions, actionType) {
    if (!actions || !Array.isArray(actions)) return 0;
    const action = actions.find(a => a.action_type === actionType);
    return action ? parseFloat(action.value) : 0;
}

export function safeValue(val, fallback = 0) {
    if (val === undefined || val === null || val === '') return fallback;
    return val;
}
