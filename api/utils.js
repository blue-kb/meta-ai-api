import { google } from 'googleapis';
// axios removed in favor of native fetch

/**
 * Get authenticatd Google Sheets client
 */
export async function getSheetsClient() {
    const accountKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!accountKeyStr) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY');

    let credentials;
    try {
        credentials = JSON.parse(accountKeyStr);
    } catch (e) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
}

/**
 * Fetch insights from Meta Graph API
 */
export async function fetchMetaInsights(level, fields, extraParams = {}) {
    const actId = process.env.META_ACCOUNT_ID;
    const token = process.env.META_ACCESS_TOKEN;

    if (!actId || !token) throw new Error('Missing META_ACCOUNT_ID or META_ACCESS_TOKEN');

    const url = `https://graph.facebook.com/v19.0/act_${actId}/insights`;

    const params = {
        access_token: token,
        level: level,
        fields: fields.join(','),
        time_increment: 1,
        limit: 500,
        ...extraParams
    };

    // Use date_preset only if time_range is NOT provided
    if (!params.time_range && !params.date_preset) {
        params.date_preset = 'yesterday';
    }

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

        if (!response.ok) {
            throw new Error(`Meta API error: ${data.error?.message || response.statusText}`);
        }

        if (data.data && data.data.length > 0) {
            allData = allData.concat(data.data);
        }

        // Pagination
        if (data.paging && data.paging.next) {
            currentUrl = data.paging.next;
        } else {
            currentUrl = null;
        }
    }

    return allData;
}

/**
 * Calculate derived metrics
 */
export function safeDivide(numerator, denominator) {
    return denominator > 0 ? (numerator / denominator) : 0;
}

/**
 * Get the current month's tab name
 */
export function getTabName(levelPrefix) {
    // Use "yesterday" as the date since we are syncing yesterday's data
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${levelPrefix}_${year}-${month}`;
}

/**
 * Get date string (YYYY-MM-DD) for a specific date
 */
export function getDateString(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Get yesterday's date string (YYYY-MM-DD)
 */
export function getYesterdayDateString() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return getDateString(date);
}

/**
 * Ensure tab exists, create with headers if not, then append rows.
 */
export async function appendToSheet(sheetsClient, tabName, headers, formatRowFunc, metaData) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEET_ID');

    // 1. Check if tab exists
    const spreadsheet = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === tabName);

    if (!sheetExists) {
        // 2. Create tab
        await sheetsClient.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title: tabName }
                    }
                }]
            }
        });
    }

    // 3. Verify if headers are present (check row 1)
    const headerCheck = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A1:Z1`,
    });

    const firstCell = headerCheck.data.values && headerCheck.data.values[0] && headerCheck.data.values[0][0];
    const isLegacyHeader = firstCell === 'date';

    if (!hasHeaders || isLegacyHeader) {
        // Add or upgrade headers
        await sheetsClient.spreadsheets.values.update({
            spreadsheetId,
            range: `${tabName}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
                values: [headers]
            }
        });
    }

    // 4. Format rows
    const rows = metaData.map(formatRowFunc);

    if (rows.length === 0) return 0; // nothing to append

    // 5. Append rows
    const res = await sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: `${tabName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
            values: rows
        }
    });

    return rows.length;
}

/**
 * Wipe all data and reset headers for a tab
 */
export async function wipeAndResetHeaders(sheetsClient, tabName, headers) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEET_ID');

    // 1. Clear everything
    await sheetsClient.spreadsheets.values.clear({
        spreadsheetId,
        range: `${tabName}!A:Z`
    });

    // 2. Write headers
    await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
            values: [headers]
        }
    });

    return true;
}

/**
 * Parse standard fields from meta row
 */
export function parseMetaAction(actions, actionType) {
    if (!actions) return 0;
    const action = actions.find(a => a.action_type === actionType);
    return action ? parseFloat(action.value) : 0;
}
