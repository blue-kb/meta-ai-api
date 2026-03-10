# Meta AI Data Hub

A backend system to sync Meta Ads performance data into Google Sheets for AI analysis.

## Setup Instructions

### 1. Google Sheets & Service Account
1.  Create a Google Sheet and copy its ID from the URL.
2.  Enable the **Google Sheets API** in the [Google Cloud Console](https://console.cloud.google.com/).
3.  Create a **Service Account**, download the JSON key.
4.  Share your Google Sheet with the service account's email as an **Editor**.

### 2. Vercel Environment Variables
Set the following in your Vercel project settings:

| Variable | Description |
| :--- | :--- |
| `META_ACCOUNT_ID` | Your Meta Ad Account ID (without `act_`) |
| `META_ACCESS_TOKEN` | A long-lived Meta User Access Token |
| `GOOGLE_SHEET_ID` | The ID of your Google Sheet |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | The **entire content** of your service account JSON file |
| `AI_AGENT_API_KEY` | A secret password for AI tool authentication |

## API Endpoints

-   `/api/health`: Check token validity and days until expiry.
-   `/api/sync/account`: Daily sync for account-level data.
-   `/api/sync/campaigns`: Daily sync for campaign-level data.
-   `/api/sync/adsets`: Daily sync for adset-level data.
-   `/api/sync/ads`: Daily sync for ad-level (creative) data.

These are configured to run automatically via Vercel Cron.
