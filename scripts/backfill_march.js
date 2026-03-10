import fetch from 'node-fetch';

async function backfill() {
    const dates = [
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
        '2026-03-04',
        '2026-03-05',
        '2026-03-06',
        '2026-03-07',
        '2026-03-08',
        '2026-03-09'
    ];

    const endpoints = [
        '/api/sync/account',
        '/api/sync/campaigns',
        '/api/sync/adsets',
        '/api/sync/ads'
    ];

    const baseUrl = 'https://meta-ai-api-ecru.vercel.app';

    for (const date of dates) {
        console.log(`>>> Backfilling for date: ${date}`);
        for (const ep of endpoints) {
            console.log(`  Syncing ${ep} for ${date}...`);
            try {
                const response = await fetch(`${baseUrl}${ep}?date=${date}`, {
                    headers: { 'x-api-key': 'uadKcKo072jeAjK' }
                });
                const data = await response.json();
                if (response.ok) {
                    console.log(`  ✅ Success: ${JSON.stringify(data)}`);
                } else {
                    console.error(`  ❌ Failed: ${JSON.stringify(data)}`);
                }
            } catch (error) {
                console.error(`  🔥 Error: ${error.message}`);
            }
        }
        // Small delay to prevent rate limit issues and ensure chronological order on sheets
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    console.log('>>> Backfill for March 2026 complete!');
}

backfill();
