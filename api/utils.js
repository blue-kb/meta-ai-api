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
    const params = {
        access_token: token, level, fields: fields.join(','),
        time_increment: 1, limit: 500,
        // Match Meta Ads Manager's default attribution window (7d click + 1d view)
        action_attribution_windows: JSON.stringify(['7d_click', '1d_view']),
        ...extraParams
    };
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

export function getDateString(date) {
    return date.toISOString().split('T')[0];
}

export function getYesterdayDateString() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return getDateString(date);
}

// ─── Schema ─────────────────────────────────────────────────────────────────── 
// Shared metric columns (55 columns) — same for all levels
const COMMON_METRICS = [
    // Delivery
    'spend', 'impressions', 'reach', 'frequency', 'cpm', 'cpc', 'ctr',
    'inline_link_click_ctr', 'inline_link_clicks', 'clicks',
    'unique_clicks', 'unique_ctr', 'unique_inline_link_clicks', 'unique_inline_link_click_ctr',
    'cpp', 'cost_per_inline_link_click', 'cost_per_unique_click', 'cost_per_unique_inline_link_click',
    'social_spend', 'full_view_impressions', 'full_view_reach',
    // Outbound
    'outbound_clicks', 'outbound_clicks_ctr',
    // Conversions (count)
    'landing_page_view', 'add_to_cart', 'initiate_checkout',
    'purchase', 'subscribe', 'video_view', 'thruplay',
    'post_engagement', 'page_engagement', 'like', 'comment', 'share',
    'post_reaction', 'post_save', 'leadgen', 'app_install', 'mobile_app_install', 'link_click_action',
    // Conversion values
    'purchase_value', 'subscribe_value',
    // Cost per action
    'cost_per_landing_page_view', 'cost_per_add_to_cart', 'cost_per_initiate_checkout',
    'cost_per_purchase', 'cost_per_subscribe',
    // Unique conversions
    'unique_landing_page_view', 'unique_add_to_cart', 'unique_initiate_checkout',
    'unique_purchase', 'unique_subscribe',
    // ROAS
    'purchase_roas', 'website_purchase_roas'
];

export const ACCOUNT_HEADERS = [
    'date_start', 'date_stop', 'account_id', 'account_name',
    ...COMMON_METRICS
];

export const CAMPAIGN_HEADERS = [
    'date_start', 'date_stop', 'campaign_id', 'campaign_name', 'effective_status', 'objective', 'buying_type',
    ...COMMON_METRICS
];

export const ADSET_HEADERS = [
    'date_start', 'date_stop', 'adset_id', 'adset_name', 'effective_status', 'campaign_id', 'campaign_name',
    'objective', 'buying_type', 'optimization_goal', 'bid_strategy',
    'daily_budget', 'lifetime_budget', 'budget_remaining', 'start_time', 'end_time',
    ...COMMON_METRICS
];

export const AD_HEADERS = [
    'date_start', 'date_stop', 'ad_id', 'ad_name', 'effective_status', 'adset_id', 'adset_name',
    'campaign_id', 'campaign_name',
    'quality_ranking', 'engagement_rate_ranking', 'conversion_rate_ranking',
    ...COMMON_METRICS,
    // Video
    'video_play_actions', 'video_p25_watched_actions', 'video_p50_watched_actions',
    'video_p75_watched_actions', 'video_p100_watched_actions', 'video_30_sec_watched_actions',
    'video_thruplay_watched_actions', 'video_avg_time_watched_actions',
    'video_continuous_2_sec_watched_actions',
    // Canvas
    'canvas_avg_view_time', 'canvas_avg_view_percent'
];

// Fields to request from Meta Insights API (common to all levels)
export const COMMON_INSIGHT_FIELDS = [
    'spend', 'impressions', 'reach', 'frequency', 'cpm', 'cpc', 'ctr',
    'inline_link_click_ctr', 'inline_link_clicks', 'clicks',
    'unique_clicks', 'unique_ctr', 'unique_inline_link_clicks', 'unique_inline_link_click_ctr',
    'cpp', 'cost_per_inline_link_click', 'cost_per_unique_click', 'cost_per_unique_inline_link_click',
    'social_spend', 'full_view_impressions', 'full_view_reach',
    'outbound_clicks', 'outbound_clicks_ctr',
    'actions', 'action_values', 'cost_per_action_type', 'unique_actions',
    'purchase_roas', 'website_purchase_roas'
];

// Build the 55 shared metric columns from one insights row
export function buildMetricsRow(data) {
    const outboundClicks = parseMetaAction(data.outbound_clicks, 'link_click');
    const outboundClicksCtr = parseMetaAction(data.outbound_clicks_ctr, 'link_click');
    const cp = (type) => safeValue(data.cost_per_action_type?.find(a => a.action_type === type)?.value);
    const act = (type) => parseMetaAction(data.actions, type);
    const val = (type) => parseMetaAction(data.action_values, type);
    const uniq = (type) => parseMetaAction(data.unique_actions, type);

    // Pre-compute subscribe metrics using the correct custom conversion ID
    const SUBSCRIBE_ID = 'offsite_conversion.custom.2045351792704561';
    const subscribes = act(SUBSCRIBE_ID);
    const subscribeValue = val(SUBSCRIBE_ID);
    const spend = parseFloat(data.spend) || 0;
    // Calculate cost_per_subscribe ourselves (spend / subscribes) — Meta's cost_per_action_type
    // for custom conversions is unreliable and produces inflated values
    const costPerSubscribe = subscribes > 0 ? spend / subscribes : 0;

    return [
        // Delivery
        safeValue(data.spend), safeValue(data.impressions), safeValue(data.reach),
        safeValue(data.frequency), safeValue(data.cpm), safeValue(data.cpc), safeValue(data.ctr),
        safeValue(data.inline_link_click_ctr), safeValue(data.inline_link_clicks), safeValue(data.clicks),
        safeValue(data.unique_clicks), safeValue(data.unique_ctr),
        safeValue(data.unique_inline_link_clicks), safeValue(data.unique_inline_link_click_ctr),
        safeValue(data.cpp), safeValue(data.cost_per_inline_link_click),
        safeValue(data.cost_per_unique_click), safeValue(data.cost_per_unique_inline_link_click),
        safeValue(data.social_spend), safeValue(data.full_view_impressions), safeValue(data.full_view_reach),
        // Outbound
        outboundClicks, outboundClicksCtr,
        // Conversions (count)
        act('landing_page_view'),
        act('add_to_cart'),
        act('initiate_checkout'),
        act('purchase') || act('offsite_conversion.fb_pixel_purchase'),
        subscribes,
        act('video_view'),
        act('thruplay'),
        act('post_engagement'),
        act('page_engagement'),
        act('like'),
        act('comment'),
        act('share'),
        act('post_reaction'),
        act('onsite_conversion.post_save'),
        act('leadgen_grouped') || act('leadgen'),
        act('app_install'),
        act('mobile_app_install'),
        act('link_click'),
        // Conversion values
        val('purchase') || val('offsite_conversion.fb_pixel_purchase'),
        subscribeValue,
        // Cost per action
        cp('landing_page_view'),
        cp('add_to_cart'),
        cp('initiate_checkout'),
        cp('purchase') || cp('offsite_conversion.fb_pixel_purchase'),
        costPerSubscribe,
        // Unique conversions
        uniq('landing_page_view'),
        uniq('add_to_cart'),
        uniq('initiate_checkout'),
        uniq('purchase') || uniq('offsite_conversion.fb_pixel_purchase'),
        uniq(SUBSCRIBE_ID),
        // ROAS
        safeValue(data.purchase_roas?.[0]?.value),
        safeValue(data.website_purchase_roas?.[0]?.value),
    ];
}

// ─── Tab ordering helpers ────────────────────────────────────────────────────
const LEVEL_ORDER = { 'Account': 0, 'Campaigns': 1, 'AdSets': 2, 'Ads': 3 };

function parseTabName(title) {
    const m = title.match(/^(Account|Campaigns|AdSets|Ads)_(\d{4})-(\d{2})$/);
    return m ? { level: m[1], year: parseInt(m[2]), month: parseInt(m[3]) } : null;
}

function tabScore(title) {
    const p = parseTabName(title);
    if (!p) return -Infinity;
    return p.year * 10000 + p.month * 10 - (LEVEL_ORDER[p.level] ?? 9);
}

// Returns the index a new tab should be inserted at (newest-first order)
function getInsertIndex(existingSheets, newTabName) {
    const newScore = tabScore(newTabName);
    return existingSheets.filter(s => tabScore(s.properties.title) > newScore).length;
}

// ─── appendToSheet ────────────────────────────────────────────────────────────
export async function appendToSheet(sheetsClient, tabName, headers, formatRowFunc, metaData) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEET_ID');
    if (metaData.length === 0) return 0;
    const newRows = metaData.map(data => {
        const row = formatRowFunc(data);
        if (row[0] && typeof row[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row[0])) {
            row[0] = "'" + row[0];
        }
        return row;
    });
    const targetDates = new Set(newRows.map(row => String(row[0]).replace(/^'/, '')));
    const spreadsheet = await sheetsClient.spreadsheets.get({ spreadsheetId });
    const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === tabName);
    if (!sheetExists) {
        const insertIndex = getInsertIndex(spreadsheet.data.sheets, tabName);
        await sheetsClient.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: [{ addSheet: { properties: { title: tabName, index: insertIndex } } }] }
        });
    }
    await sheetsClient.spreadsheets.values.update({
        spreadsheetId, range: `${tabName}!A1`,
        valueInputOption: 'RAW', requestBody: { values: [headers] }
    });
    const existing = await sheetsClient.spreadsheets.values.get({
        spreadsheetId, range: `${tabName}!A2:ZZZ`
    });
    const keepRows = (existing.data.values || []).filter(row => {
        const cellDate = String(row[0] || '').replace(/^'/, '');
        return !targetDates.has(cellDate);
    });
    const allRows = [...keepRows, ...newRows];
    allRows.sort((a, b) => {
        const da = String(a[0] || '').replace(/^'/, '');
        const db = String(b[0] || '').replace(/^'/, '');
        return da.localeCompare(db);
    });
    await sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: `${tabName}!A2:ZZZ` });
    if (allRows.length > 0) {
        await sheetsClient.spreadsheets.values.update({
            spreadsheetId, range: `${tabName}!A2`,
            valueInputOption: 'USER_ENTERED', requestBody: { values: allRows }
        });
    }
    return newRows.length;
}

export async function wipeAndResetHeaders(sheetsClient, tabName, headers) {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEET_ID');
    await sheetsClient.spreadsheets.values.clear({ spreadsheetId, range: `${tabName}!A:ZZZ` });
    await sheetsClient.spreadsheets.values.update({
        spreadsheetId, range: `${tabName}!A1`,
        valueInputOption: 'RAW', requestBody: { values: [headers] }
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
