import 'dotenv/config';
import http from 'http';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, type GenerateContentResponse, Modality } from '@google/genai';
import {
  ALL_COUNTRIES,
  getCountryByCode,
  buildVerifiedFallbackAnswer,
  validateDataIssueReport,
  type ValidatedDataIssueReport,
  type DataIssueReportInput,
  validatePhotoToVideoRequest,
  type PhotoToVideoRequestInput,
} from './src/lib/emergencyData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const submittedIssueReports: ValidatedDataIssueReport[] = [];

// Simple in-memory sliding-window rate limiter per IP for /api/* routes
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'local';
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  record.count += 1;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error:
        'Too many requests. For immediate life-threatening emergencies, please dial your local universal emergency number directly.',
    });
  }
  return next();
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function resolveAllowedModel(): string {
  const configured = (process.env.GEMINI_MODEL || '').trim();
  const deprecated = new Set([
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-thinking',
  ]);
  if (!configured || deprecated.has(configured)) {
    return 'gemini-3.8-flash';
  }
  if (configured === 'gemini-2.5-flash') {
    return 'gemini-3.8-flash';
  }
  return configured;
}

function buildEmergencySystemInstruction(countryCode: string): string {
  const countryData = getCountryByCode(countryCode || 'IN');
  return `You are the JANMITER assistant. You know this website and the emergency numbers of every country.
- Reply in the same language the user writes or speaks in.
- Prefer the site's verified JSON data for the user's selected country (${countryData.country}, code: ${countryData.code}) over your own memory. If unsure, say so and give the universal emergency number (${countryData.universal.map((u) => u.number).join(' / ')}).
- Always state WHO each number is for and WHEN to use it.
- For life-threatening situations, FIRST tell the user to call the local emergency number immediately, then give short first-aid or safety guidance.
- Never invent numbers. Never give a medical diagnosis. Keep answers short, structured, and crystal clear.

VERIFIED JSON DATA FOR ${countryData.country.toUpperCase()} (${countryData.code}):
${JSON.stringify(countryData, null, 2)}`;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Increase payload limit to support base64 audio transcription payloads
  app.use(express.json({ limit: '12mb' }));

  // Serve raw JSON files at /data/emergency-numbers/{code}.json for direct fetch / PWA caching,
  // while letting Vite transform `?import` module requests in dev mode.
  const staticEmergencyJson = express.static(
    path.join(__dirname, 'data', 'emergency-numbers'),
    { maxAge: '1d' }
  );
  app.use('/data/emergency-numbers', (req: Request, res: Response, next: NextFunction) => {
    if ('import' in req.query || req.originalUrl.includes('?import')) {
      return next();
    }
    return staticEmergencyJson(req, res, next);
  });

  // Apply rate limiting to all API routes
  app.use('/api', apiRateLimiter);

  // GET /api/maps-config — Expose provisioned Google Maps API key for client @vis.gl/react-google-maps
  app.get('/api/maps-config', (_req: Request, res: Response) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ apiKey });
  });

  // GET /api/countries
  app.get('/api/countries', (_req: Request, res: Response) => {
    res.json({ countries: ALL_COUNTRIES });
  });

  // GET /api/countries/:code
  app.get('/api/countries/:code', (req: Request, res: Response) => {
    const country = getCountryByCode(String(req.params.code || 'IN'));
    res.json({ country });
  });

  // POST /api/report-issue — Submit feedback about an incorrect emergency number
  app.post('/api/report-issue', (req: Request, res: Response) => {
    const validation = validateDataIssueReport(req.body as DataIssueReportInput);
    if (!validation.valid || !validation.report) {
      return res.status(400).json({
        error: validation.error || 'Invalid report submission.',
      });
    }
    submittedIssueReports.unshift(validation.report);
    return res.status(201).json({
      ok: true,
      report: validation.report,
      totalReports: submittedIssueReports.length,
    });
  });

  // POST /api/animate-photo — Animate uploaded photo into 16:9 or 9:16 video via Interactions API (gemini-omni-1.1-flash)
  app.post('/api/animate-photo', async (req: Request, res: Response) => {
    const validation = validatePhotoToVideoRequest(
      req.body as PhotoToVideoRequestInput
    );
    if (!validation.valid || !validation.data) {
      return res.status(400).json({
        error: validation.error || 'Invalid photo-to-video request.',
      });
    }

    const { imageBase64, mimeType, prompt, aspectRatio } = validation.data;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(200).json({
        ok: true,
        model: 'gemini-omni-1.1-flash',
        aspectRatio,
        videoUrl: '/earth-night-loop.mp4',
        simulatedFallback: true,
        notice:
          'Showing local simulation preview stream. Configure a paid GEMINI_API_KEY in Settings > Secrets to generate live videos via gemini-omni-1.1-flash.',
      });
    }

    try {
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.1-flash',
          input: [
            {
              type: 'image',
              mime_type: mimeType,
              data: imageBase64,
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: aspectRatio,
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (videoPart?.data) {
        const outMime = videoPart.mime_type || 'video/mp4';
        return res.status(200).json({
          ok: true,
          model: 'gemini-omni-1.1-flash',
          aspectRatio,
          videoUrl: `data:${outMime};base64,${videoPart.data}`,
          simulatedFallback: false,
        });
      }
      if (videoPart?.uri) {
        return res.status(200).json({
          ok: true,
          model: 'gemini-omni-1.1-flash',
          aspectRatio,
          videoUrl: videoPart.uri,
          simulatedFallback: false,
        });
      }

      // Check steps array if output_video helper was empty
      for (const step of interaction.steps || []) {
        if (step.type === 'model_output') {
          const vidContent = step.content?.find((c: any) => c.type === 'video') as
            | { data?: string; uri?: string; mime_type?: string }
            | undefined;
          if (vidContent?.data) {
            const outMime = vidContent.mime_type || 'video/mp4';
            return res.status(200).json({
              ok: true,
              model: 'gemini-omni-1.1-flash',
              aspectRatio,
              videoUrl: `data:${outMime};base64,${vidContent.data}`,
              simulatedFallback: false,
            });
          }
          if (vidContent?.uri) {
            return res.status(200).json({
              ok: true,
              model: 'gemini-omni-1.1-flash',
              aspectRatio,
              videoUrl: vidContent.uri,
              simulatedFallback: false,
            });
          }
        }
      }

      return res.status(200).json({
        ok: true,
        model: 'gemini-omni-1.1-flash',
        aspectRatio,
        videoUrl: '/earth-night-loop.mp4',
        simulatedFallback: true,
        notice:
          'No video bytes returned by model; showing local emergency simulation video.',
      });
    } catch (error) {
      console.error('Gemini Interactions API /api/animate-photo error:', error);
      return res.status(200).json({
        ok: true,
        model: 'gemini-omni-1.1-flash',
        aspectRatio,
        videoUrl: '/earth-night-loop.mp4',
        simulatedFallback: true,
        notice:
          'Using local simulation video preview (select a paid Gemini API key in Settings > Secrets for live gemini-omni-1.1-flash video generation).',
      });
    }
  });

  // POST /api/transcribe — Audio Transcription using gemini-3.5-transcribe
  app.post('/api/transcribe', async (req: Request, res: Response) => {
    const { audioBase64, mimeType, countryCode, fallbackHint } = req.body as {
      audioBase64?: string;
      mimeType?: string;
      countryCode?: string;
      fallbackHint?: string;
    };

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'audioBase64 is required.' });
    }

    const countryData = getCountryByCode(countryCode || 'IN');
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        text:
          fallbackHint ||
          `What is the highway ambulance emergency number in ${countryData.country}?`,
        model: 'gemini-3.5-transcribe',
        fallbackUsed: true,
      });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this audio accurately. Return only the spoken words.',
            },
          ],
        },
      });

      const transcript = (response.text || '').trim();
      return res.json({
        text:
          transcript ||
          fallbackHint ||
          `Emergency ambulance number in ${countryData.country}`,
        model: 'gemini-3.5-transcribe',
      });
    } catch (error) {
      console.error('Gemini /api/transcribe error:', error);
      return res.json({
        text:
          fallbackHint ||
          `What is the highway ambulance emergency number in ${countryData.country}?`,
        model: 'gemini-3.5-transcribe',
        fallbackUsed: true,
      });
    }
  });

  // POST /api/chat — Streaming Gemini Emergency Assistant
  app.post('/api/chat', async (req: Request, res: Response) => {
    const { message, countryCode, history } = req.body as {
      message?: string;
      countryCode?: string;
      history?: { role: 'user' | 'model'; text: string }[];
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const countryData = getCountryByCode(countryCode || 'IN');

    // Set headers for Server-Sent Events (SSE) streaming
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const systemInstruction = buildEmergencySystemInstruction(countryData.code);
    const ai = getGeminiClient();

    if (!ai) {
      const fallbackText = buildVerifiedFallbackAnswer(message, countryData);
      const chunks = fallbackText.match(/.{1,36}(\s|$)|\S+/g) || [fallbackText];
      for (const piece of chunks) {
        res.write(`data: ${JSON.stringify({ text: piece })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    }

    try {
      const modelName = resolveAllowedModel();
      const conversationContext = Array.isArray(history)
        ? history
            .slice(-6)
            .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
            .join('\n')
        : '';

      const prompt = conversationContext
        ? `Previous conversation:\n${conversationContext}\n\nCurrent user question (${countryData.country}): ${message}`
        : `User question (Selected country: ${countryData.country}): ${message}`;

      const stream = await ai.models.generateContentStream({
        model: modelName,
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      for await (const chunk of stream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          res.write(`data: ${JSON.stringify({ text: c.text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    } catch (error) {
      console.error('Gemini /api/chat error, using verified country JSON fallback:', error);
      const fallbackText = buildVerifiedFallbackAnswer(message, countryData);
      res.write(`data: ${JSON.stringify({ text: fallbackText })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, fallbackUsed: true })}\n\n`);
      return res.end();
    }
  });

  // POST /api/tts — ElevenLabs Multilingual v2 Text-to-Speech
  app.post('/api/tts', async (req: Request, res: Response) => {
    const { text } = req.body as { text?: string };
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for TTS.' });
    }

    const cleanText = text
      .replace(/[*#_`~>-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 900);

    const elevenApiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'Fo1P5yVLG09zFcOP3CtY';

    if (
      !elevenApiKey ||
      elevenApiKey === 'MY_ELEVENLABS_API_KEY' ||
      elevenApiKey.trim() === ''
    ) {
      return res.status(200).json({
        fallbackToBrowserTts: true,
        reason: 'ElevenLabs API key not configured; using browser SpeechSynthesis fallback.',
      });
    }

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenApiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.55,
              similarity_boost: 0.78,
            },
          }),
        }
      );

      if (!response.ok || !response.body) {
        return res.status(200).json({
          fallbackToBrowserTts: true,
          reason: `ElevenLabs returned status ${response.status}`,
        });
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-cache');
      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (err) {
      console.error('ElevenLabs TTS error:', err);
      return res.status(200).json({
        fallbackToBrowserTts: true,
        reason: 'Network error contacting ElevenLabs; using browser SpeechSynthesis.',
      });
    }
  });

  // WebSocket Server at /live — Real-Time Bidirectional Voice with gemini-3.8-live
  // Use { noServer: true } so non-/live WebSocket upgrades (such as @vite/client) are never aborted.
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname === '/live') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    } catch {
      // ignore malformed upgrade URLs
    }
  });

  wss.on('connection', async (ws: WebSocket, req) => {
    const url = new URL(req.url || '/live', `http://${req.headers.host || 'localhost'}`);
    const countryCode = url.searchParams.get('country') || 'IN';
    const countryData = getCountryByCode(countryCode);
    const ai = getGeminiClient();

    if (!ai) {
      ws.send(
        JSON.stringify({
          type: 'outputTranscript',
          text: `Live Voice connected (${countryData.country}). Dial ${countryData.universal[0].number} immediately for any life-threatening emergency. Configure GEMINI_API_KEY in Secrets to enable live audio streaming with gemini-3.8-live.`,
        })
      );
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'text' && msg.text) {
            const reply = buildVerifiedFallbackAnswer(msg.text, countryData);
            ws.send(JSON.stringify({ type: 'outputTranscript', text: reply }));
          }
        } catch {
          // ignore malformed messages
        }
      });
      return;
    }

    let session: any = null;
    try {
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: {
            parts: [{ text: buildEmergencySystemInstruction(countryData.code) }],
          },
        },
        callbacks: {
          onopen: () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'status',
                  text: `Gemini Live (gemini-3.8-live) connected for ${countryData.country}`,
                })
              );
            }
          },
          onmessage: (message: any) => {
            if (ws.readyState !== WebSocket.OPEN) return;

            const parts = message.serverContent?.modelTurn?.parts;
            if (Array.isArray(parts)) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  ws.send(
                    JSON.stringify({
                      type: 'audio',
                      data: part.inlineData.data,
                    })
                  );
                }
              }
            }

            if (message.serverContent?.interrupted) {
              ws.send(JSON.stringify({ type: 'interrupted' }));
            }

            if (message.serverContent?.inputTranscription?.text) {
              ws.send(
                JSON.stringify({
                  type: 'inputTranscript',
                  text: message.serverContent.inputTranscription.text,
                })
              );
            }

            if (message.serverContent?.outputTranscription?.text) {
              ws.send(
                JSON.stringify({
                  type: 'outputTranscript',
                  text: message.serverContent.outputTranscription.text,
                })
              );
            }
          },
          onerror: (err: unknown) => {
            console.error('Gemini Live error:', err);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: 'error',
                  text: 'Live audio session encountered an error.',
                })
              );
            }
          },
          onclose: () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
          },
        },
      });
    } catch (err) {
      console.error('Failed to connect to gemini-3.8-live:', err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'outputTranscript',
            text: `Live session fallback (${countryData.country}): Call ${countryData.universal[0].number} for immediate emergency dispatch.`,
          })
        );
      }
      return;
    }

    ws.on('message', (data) => {
      if (!session) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'audio' && msg.data) {
          session.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (msg.type === 'text' && msg.text) {
          session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: msg.text }] }],
            turnComplete: true,
          });
        }
      } catch (e) {
        console.error('Error forwarding WS message to Gemini Live:', e);
      }
    });

    ws.on('close', () => {
      try {
        session?.close();
      } catch {
        // ignore close error
      }
    });
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const hmrEnabled = process.env.DISABLE_HMR !== 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrEnabled ? { server } : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`JANMITER server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
