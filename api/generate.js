module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: "GEMINI_API_KEY is not set in Vercel" });

  const prompt = req.body && req.body.prompt;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 40000) {
    return res.status(400).json({ error: "Bad prompt" });
  }

  // If one model is busy, the next one is tried.
  const models = ["gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  if (process.env.GEMINI_MODEL) models.unshift(process.env.GEMINI_MODEL);

  let lastStatus = 502;
  for (const model of models) {
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
        console.error("Gemini error", model, r.status, JSON.stringify(data).slice(0, 300));
        lastStatus = r.status;
        continue;
      }
      const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
      const text = parts.map((p) => p.text || "").join("");
      if (text) return res.status(200).json({ text });
      console.error("Empty answer from", model);
    } catch (e) {
      console.error("Request failed", model, e);
    }
  }
  return res.status(lastStatus === 429 ? 429 : 502).json({ error: "AI request failed" });
};
