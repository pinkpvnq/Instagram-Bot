import express from "express";
import cors from "cors";
import ytdl from "@distube/ytdl-core";
import { YoutubeTranscript } from "youtube-transcript-api";
import OpenAI from "openai";

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.netlify.app']
    : ['http://localhost:5173', 'http://localhost:4173'],
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get("/health", (_req, res) => res.json({ ok: true }));

// утилиты
const extractVideoId = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {}
  return null;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// основной маршрут
app.post("/api/transcribe", async (req, res) => {
  try {
    const { url, options = {} } = req.body || {};
    if (!url) return res.status(400).json({ error: "Missing url" });

    // — Проверка длительности (<= 3 часа)
    const info = await ytdl.getInfo(url);
    const seconds = parseInt(info.videoDetails.lengthSeconds || "0", 10);
    if (!Number.isFinite(seconds)) {
      return res.status(400).json({ error: "Cannot read video duration" });
    }
    if (seconds > 3 * 60 * 60) {
      return res.status(400).json({ error: "Video exceeds 3-hour limit" });
    }

    // — Попытка #1: официальные субтитры
    try {
      const vid = extractVideoId(url);
      if (vid) {
        const lang = options.language || "en";
        let tracks = await YoutubeTranscript.fetchTranscript(vid, { lang });
        if (!tracks?.length) {
          // auto-detect: берём первый доступный
          const all = await YoutubeTranscript.listAvailableTranscripts(vid);
          const first = all?.find(Boolean);
          if (first?.language) {
            tracks = await YoutubeTranscript.fetchTranscript(vid, { lang: first.language });
          }
        }
        if (tracks?.length) {
          const text = tracks.map(t => t.text).join(" ").replace(/\s+/g, " ").trim();
          return res.json({
            transcript: text,
            language: options.language || "auto",
            duration: seconds,
            source: "youtube_captions"
          });
        }
      }
    } catch (_) {
      // игнор, идём в Whisper
    }

    // — Попытка #2: Whisper ASR по чанкам (без ffmpeg, по битрейту)
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" });
    const bitrate = format.bitrate || 128000;               // bits/sec
    const bytesPerSec = Math.max(16000, Math.floor(bitrate / 8)); // запас
    const chunkBytes = bytesPerSec * 600;                   // 10 минут
    const overlap = bytesPerSec * 2;                        // ~2 сек перекрытие

    const buffers = [];
    await new Promise((resolve, reject) => {
      const s = ytdl(url, { quality: "highestaudio", filter: "audioonly" });
      s.on("data", b => buffers.push(b));
      s.on("end", resolve);
      s.on("error", reject);
    });
    const audio = Buffer.concat(buffers);

    const chunks = [];
    for (let off = 0; off < audio.length; off += (chunkBytes - overlap)) {
      const end = Math.min(off + chunkBytes, audio.length);
      chunks.push(audio.slice(off, end));
      if (end >= audio.length) break;
    }

    const parts = [];
    for (let i = 0; i < chunks.length; i++) {
      // большинство YouTube аудио из ytdl — webm/opus; Whisper принимает webm
      const file = new File([chunks[i]], `chunk-${i}.webm`, { type: "audio/webm" });
      const r = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file,
        response_format: "text",
        language: options.autoLanguageDetection === false ? options.language : undefined,
        temperature: 0
      });
      parts.push(String(r || "").trim());
      if (i < chunks.length - 1) await sleep(800);
    }

    // простая стыковка с анти-дубликатами на стыках
    let transcript = "";
    for (let i = 0; i < parts.length; i++) {
      let seg = parts[i];
      if (i > 0) {
        const prevTail = transcript.split(" ").slice(-12).join(" ").toLowerCase();
        const currHead = seg.split(" ").slice(0, 12).join(" ").toLowerCase();
        if (prevTail === currHead) seg = seg.split(" ").slice(12).join(" ");
      }
      transcript += (transcript ? " " : "") + seg;
    }

    res.json({
      transcript: transcript.trim(),
      language: options.language || "auto",
      duration: seconds,
      source: "whisper_asr"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || String(err) });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`PinkPvnq API listening on :${port}`));
