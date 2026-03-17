export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const mode = req.query.mode || '7days';
    const baseUrl = 'https://meta-ai-api-ecru.vercel.app';
    const levels = ['account', 'campaigns', 'adsets', 'ads'];

    const now = new Date();
    let startParam, endParam;

    if (mode === 'today') {
        startParam = endParam = now.toISOString().split('T')[0];
    } else {
        const end = new Date(now);
        end.setUTCDate(end.getUTCDate() - 1);
        const start = new Date(now);
        start.setUTCDate(start.getUTCDate() - 7);
        startParam = start.toISOString().split('T')[0];
        endParam = end.toISOString().split('T')[0];
    }

    const results = [];
    let errors = 0;

    for (const level of levels) {
        try {
            const url = `${baseUrl}/api/sync/${level}?start=${startParam}&end=${endParam}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'x-api-key': process.env.AI_AGENT_API_KEY }
            });
            const data = await response.json();
            results.push({ level, status: response.status, rows_added: data.rows_added ?? 0 });
            if (!response.ok) errors++;
        } catch (err) {
            results.push({ level, error: err.message });
            errors++;
        }
    }

    return res.status(200).json({
        status: errors === 0 ? 'ok' : 'partial',
        mode,
        date_range: { start: startParam, end: endParam },
        total_syncs: results.length,
        errors,
        results
    });
}
