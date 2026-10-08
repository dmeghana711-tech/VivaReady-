module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel" });

  const prompt = req.body && req.body.prompt;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 40000) {
    return res.status(400).json({ error: "Bad prompt" });
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16384 },
        }),
      }
    );
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("Gemini error", r.status, JSON.stringify(data).slice(0, 500));
      return res.status(r.status === 429 ? 429 : 502).json({ error: "AI request failed" });
    }
    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map((p) => p.text || "").join("");
    if (!text) return res.status(502).json({ error: "Empty answer" });
    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "AI request failed" });
  }
};
