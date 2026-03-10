export default function handler(req, res) {
    res.status(200).json({ message: "Vercel execution environment is active", timestamp: new Date().toISOString() });
}
