import {
  Type,
  generateStructuredJson,
  requireAuthAndRateLimit
} from "./_lib/ai-helper.mjs";

function parseDataUrlImage(imageStr) {
  const raw = String(imageStr || "").trim();
  const m = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (m) {
    return {
      mimeType: m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase(),
      data: m[2].replace(/\s+/g, "")
    };
  }
  return null;
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const gate = await requireAuthAndRateLimit();
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json().catch(() => null);
    const mode = String(body?.mode || "handwriting").trim();
    const img = parseDataUrlImage(body?.image);
    if (!img) {
      return Response.json({ ok: false, error: "รูปภาพไม่ถูกต้อง (รองรับ PNG/JPEG/WebP)" }, { status: 400 });
    }

    const uiLang = String(req.headers.get("x-nihao-lang") || body?.lang || "th").toLowerCase() === "en" ? "English" : "Thai";

    if (mode === "handwriting") {
      const expectedChars = String(body?.chars || "").trim().slice(0, 24);
      const { data: report, model } = await generateStructuredJson({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: img },
              { text: `Target Chinese characters on this copybook sheet: "${expectedChars || "detect written characters"}". Grade the learner's handwriting proportions, stroke balance, and center of gravity.` }
            ]
          }
        ],
        systemInstruction:
          `You are an encouraging Chinese calligraphy & handwriting teacher for ${uiLang} learners. ` +
          `Analyze the handwritten Simplified Chinese characters in the grid image. ` +
          `Assign overallGrade ("S", "A", "B", or "C"), overallScore (0-100), a warm ${uiLang} summary, and per-character feedback items with {char, score, balance, tip} in ${uiLang}.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallGrade: { type: Type.STRING },
            overallScore: { type: Type.INTEGER },
            summary: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  char: { type: Type.STRING },
                  score: { type: Type.INTEGER },
                  balance: { type: Type.STRING },
                  tip: { type: Type.STRING }
                },
                required: ["char", "score", "balance", "tip"]
              }
            }
          },
          required: ["overallGrade", "overallScore", "summary", "items"]
        }
      });
      return Response.json({ ok: true, model, usage: gate.usage, report }, { headers: { "Cache-Control": "no-store" } });
    }

    if (mode === "snap") {
      const { data: snap, model } = await generateStructuredJson({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: img },
              { text: "Extract all useful Mandarin Chinese words/menu items/signs from this photo and teach the learner how to read and use them in real life." }
            ]
          }
        ],
        systemInstruction:
          `You are a practical Mandarin Chinese travel & menu assistant for ${uiLang} learners. ` +
          `Read Chinese signs, menus, labels, or objects in the photo. Return sceneTitle (${uiLang}), contextTip (${uiLang}), ` +
          `items (up to 10 extracted Chinese words/dishes with {hz, py, th, note}), and orderPhrases (2-3 natural spoken Chinese sentences with {hz, py, th}).`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sceneTitle: { type: Type.STRING },
            contextTip: { type: Type.STRING },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  hz: { type: Type.STRING },
                  py: { type: Type.STRING },
                  th: { type: Type.STRING },
                  note: { type: Type.STRING }
                },
                required: ["hz", "py", "th", "note"]
              }
            },
            orderPhrases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  hz: { type: Type.STRING },
                  py: { type: Type.STRING },
                  th: { type: Type.STRING }
                },
                required: ["hz", "py", "th"]
              }
            }
          },
          required: ["sceneTitle", "contextTip", "items", "orderPhrases"]
        }
      });
      return Response.json({ ok: true, model, usage: gate.usage, snap }, { headers: { "Cache-Control": "no-store" } });
    }

    if (mode === "recognize") {
      const strokeHint = Number(body?.strokeCount || 0);
      const { data, model } = await generateStructuredJson({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: img },
              { text: `Recognize the single handwritten Simplified Chinese character drawn on this canvas (${strokeHint || "several"} strokes). Return top 6 candidates.` }
            ]
          }
        ],
        systemInstruction:
          `You are an optical Chinese handwriting recognizer. Return JSON {candidates: [{hz, py, th}]} with the 6 most likely Simplified Chinese characters, Pinyin, and ${uiLang} meaning.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            candidates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  hz: { type: Type.STRING },
                  py: { type: Type.STRING },
                  th: { type: Type.STRING }
                },
                required: ["hz", "py", "th"]
              }
            }
          },
          required: ["candidates"]
        }
      });
      return Response.json({ ok: true, model, usage: gate.usage, candidates: data.candidates || [] }, { headers: { "Cache-Control": "no-store" } });
    }

    return Response.json({ ok: false, error: "Unsupported vision mode" }, { status: 400 });
  } catch (err) {
    console.error("[ai-vision] Error:", err);
    return Response.json({ ok: false, error: "ระบบ Gemini Vision ไม่พร้อมใช้งานชั่วคราว" }, { status: 500 });
  }
};

export const config = {
  path: "/api/ai/vision"
};
