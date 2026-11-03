// صوت المستشار بصوت Gemini الطبيعي (نفس مسار براندي) — المفتاح يبقى على الخادم.
const { sameOrigin } = require("./_origin");

function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

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
    const text = String((req.body || {}).text || "").slice(0, 1500);
    if (!text) {
      res.status(400).json({ error: "text required" });
      return;
    }
    const model = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
    const voiceName = process.env.GEMINI_VOICE_NAME || "Kore";
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "TTS the following text verbatim, in a warm natural Saudi Arabic voice, with no extra commentary: " + text }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      res.status(r.status).json({ error: data });
      return;
    }
    const parts = data.candidates?.[0]?.content?.parts || [];
    const inline = parts.map((p) => p.inlineData || p.inline_data).find(Boolean);
    if (!inline?.data) {
      res.status(502).json({ error: "لم يرجع Gemini صوتًا" });
      return;
    }
    res.setHeader("content-type", "audio/wav");
    res.status(200).send(pcmToWav(Buffer.from(inline.data, "base64"), 24000));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 30 };
