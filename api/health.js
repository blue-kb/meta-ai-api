export default async function handler(req, res) {
    // 1. Authenticate with x-api-key header
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.AI_AGENT_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const token = process.env.META_ACCESS_TOKEN;

        // Check Meta Token Validity
        const debugUrl = `https://graph.facebook.com/v19.0/debug_token?input_token=${token}&access_token=${token}`;
        const response = await fetch(debugUrl);
        const resJson = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: 'Meta API Error',
                message: resJson.error?.message || 'External API failure'
            });
        }

        const tokenData = resJson.data;

        // Check Days until expiry
        let daysUntilExpiry = 'Never';
        if (tokenData.data_access_expires_at) {
            const diff = tokenData.data_access_expires_at * 1000 - Date.now();
            daysUntilExpiry = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
        }

        return res.status(200).json({
            status: 'ok',
            token_valid: tokenData.is_valid,
            days_until_expiry: daysUntilExpiry,
            last_sync: new Date().toISOString()
        });
    } catch (error) {
        console.error('Health check error:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            details: error.message
        });
    }
}
