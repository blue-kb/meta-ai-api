export default async function handler(req, res) {
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const baseUrl = 'https://meta-ai-api-ecru.vercel.app';
    const levels = ['account', 'campaigns', 'adsets', 'ads'];

    const dates = [];
    for (let i = 1; i <= 7; i++) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }

    const results = [];
    let errors = 0;

    for (const date of dates) {
        for (const level of levels) {
            try {
                const response = await fetch(`${baseUrl}/api/sync/${level}?date=${date}`, {
                    method: 'POST',
                    headers: { 'x-api-key': process.env.AI_AGENT_API_KEY }
                });
                const data = await response.json();
                results.push({ date, level, status: response.status, rows_added: data.rows_added ?? 0 });
                if (!response.ok) errors++;
            } catch (err) {
                results.push({ date, level, error: err.message });
                errors++;
            }
        }
    }

    return res.status(200).json({
        status: errors === 0 ? 'ok' : 'partial',
        dates_synced: dates,
        total_syncs: results.length,
        errors,
        results
    });
}
