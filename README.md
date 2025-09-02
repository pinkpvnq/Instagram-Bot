# YouTube Transcriber API

Backend service for YouTube video transcription using OpenAI Whisper and official YouTube captions.

## Features
- YouTube video transcription via Whisper ASR
- Fallback to official YouTube captions
- Proper audio chunking by bitrate
- JSON-only responses
- CORS enabled

## Deploy on Render
1. Create new Web Service
2. Runtime: Node 20
3. Build: `npm install`
4. Start: `npm start`
5. Environment Variables:
   ```
   OPENAI_API_KEY=your-key
   PORT=8080
   NODE_ENV=production
   ```

## Development
```bash
npm install
export OPENAI_API_KEY=your-key
npm start
```

Test: `curl http://localhost:8080/health`
