// رمز مؤقت لمرة واحدة لجلسة Gemini Live — المفتاح نفسه لا يصل للمتصفح.
const { sameOrigin } = require("./_origin");

async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: "GEMINI_API_KEY غير مُعدّ على الخادم" });
      return;
    }
    const now = Date.now();
    const expireTime = new Date(now + 30 * 60 * 1000).toISOString().replace(/\.\d+Z$/, "Z");
    const newSessionExpireTime = new Date(now + 5 * 60 * 1000).toISOString().replace(/\.\d+Z$/, "Z");

    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: data });
      return;
    }
    res.status(200).json({ token: data.name, model: process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 30 };
