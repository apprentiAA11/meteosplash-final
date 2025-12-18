export default async function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=fr`;

  try {
    const r = await fetch(url);
    const j = await r.json();
    res.status(200).json(j);
  } catch (e) {
    res.status(500).json({ error: "Reverse geocoding failed" });
  }
}
