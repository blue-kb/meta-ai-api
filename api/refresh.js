export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const mode = req.query.mode || '7days';
    const baseUrl = 'https://meta-ai-api-ecru.vercel.app';
    const levels = ['account', 'campaigns', 'adsets', 'ads'];

    const dates = [];
    const now = new Date();

    if (mode === 'today') {
        dates.push(now.toISOString().split('T')[0]);
    } else {
        for (let i = 1; i <= 7; i++) {
            const d = new Date(now);
            d.setUTCDate(d.getUTCDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
    }

    const results = [];
    let errors = 0;

    for (const date of dates) {
        for (const level of levels) {
            try {
                const response = await fetch(baseUrl + '/api/sync/' + level + '?date=' + date, {
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
        mode,
        dates_synced: dates,
        total_syncs: results.length,
        errors,
        results
    });
}
