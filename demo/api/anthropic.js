// وسيط Claude لكتابة المسودة وفهم الرسائل المكتوبة — المفتاح يبقى على الخادم.
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
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY غير مُعدّ على الخادم" });
      return;
    }
    const body = req.body || {};
    if (!Array.isArray(body.messages)) {
      res.status(400).json({ error: "messages required" });
      return;
    }
    const payload = {
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: Math.min(Number(body.max_tokens) || 1024, 8000),
      messages: body.messages,
    };
    if (body.system) payload.system = body.system;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 60 };
