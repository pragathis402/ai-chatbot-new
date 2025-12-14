import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("❌ GOOGLE_API_KEY missing");
  process.exit(1);
}

/* ✅ GEMINI 2.5 FLASH MODEL */
const MODEL_QUEUE = [
  "gemini-2.5-flash"
];

// Helper delay
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Main generator
async function generateContent(prompt, history) {
  const model = MODEL_QUEUE[0];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

  const contents = [];

  if (Array.isArray(history)) {
    history.forEach(m => {
      if (!m.content) return;
      contents.push({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      });
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: prompt }]
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents })
  });

  const raw = await response.text();
  if (!raw) throw new Error("Empty API response");

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Bad JSON: " + raw);
  }

  if (!response.ok) {
    throw new Error(data.error?.message || "API failed");
  }

  return data;
}

// Text route
app.post("/generate", async (req, res) => {
  const { prompt, history } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt missing" });

  try {
    const data = await generateContent(prompt, history);

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response";

    res.json({ response: text, model: "gemini-2.5-flash" });

  } catch (err) {
    console.error("🔥 Error:", err.message);
    res.status(500).json({
      error: err.message,
      response: "API error. Check quota or model availability."
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`🤖 Model: gemini-2.5-flash`);
});
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

app.post("/exportPDF", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "No content provided" });
    }

    // Create a PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const fontSize = 12;
    const maxWidth = 500;
    let y = 800;

    // Split text into lines
    const lines = font.splitTextIntoLines(content, maxWidth);

    lines.forEach(line => {
      if (y < 40) {
        page = pdfDoc.addPage([595, 842]);
        y = 800;
      }
      page.drawText(line, {
        x: 50,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      y -= fontSize + 5;
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=export.pdf");
    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
