import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import twilio from 'twilio';
import africastalking from 'africastalking';
import { GoogleGenAI, Modality } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3000;

// Helper for Twilio Client
const getTwilioClient = (sid?: string, token?: string) => {
  const accountSid = sid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = token || process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials missing');
  }
  return twilio(accountSid, authToken);
};

// Helper for Africa's Talking Client
const getAtClient = (username?: string, apiKey?: string) => {
  const atUsername = username || process.env.AT_USERNAME;
  const atApiKey = apiKey || process.env.AT_API_KEY;
  if (!atUsername || !atApiKey) {
    throw new Error('Africa\'s Talking credentials missing');
  }
  return africastalking({ username: atUsername, apiKey: atApiKey });
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API: Initiate Outbound Call
app.post('/api/calls/outbound', async (req, res) => {
  const { to, instructions, geminiKey } = req.body;
  const appUrl = process.env.APP_URL || `https://${req.get('host')}`;

  // Use headers as overrides if present
  const sid = req.headers['x-twilio-sid'] as string;
  const token = req.headers['x-twilio-token'] as string;
  const from = req.headers['x-twilio-phone'] as string || process.env.TWILIO_PHONE_NUMBER;

  try {
    const client = getTwilioClient(sid, token);
    if (!from) throw new Error('Twilio phone number missing');

    const call = await client.calls.create({
      from: from,
      to: to,
      url: `${appUrl}/api/calls/twiml?instructions=${encodeURIComponent(instructions || '')}&geminiKey=${encodeURIComponent(geminiKey || '')}`,
    });
    res.json({ success: true, callSid: call.sid });
  } catch (error: any) {
    console.error('Twilio Call Error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// API: Africa's Talking Outbound Call
app.post('/api/calls/at/outbound', async (req, res) => {
  const { to } = req.body;
  
  const username = req.headers['x-at-username'] as string;
  const apiKey = req.headers['x-at-api-key'] as string;
  const from = req.headers['x-at-phone'] as string || process.env.AT_PHONE_NUMBER;

  try {
    const atClient = getAtClient(username, apiKey);
    if (!from) throw new Error('Africa\'s Talking phone number missing');
    const voice = atClient.VOICE;

    const result = await voice.call({
      callFrom: from,
      callTo: [to]
    });
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Africa\'s Talking Call Error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// API: Africa's Talking SMS
app.post('/api/sms/send', async (req, res) => {
  const { to, message } = req.body;

  const username = req.headers['x-at-username'] as string;
  const apiKey = req.headers['x-at-api-key'] as string;
  const from = req.headers['x-at-phone'] as string || process.env.AT_SHORTCODE;

  try {
    const atClient = getAtClient(username, apiKey);
    const sms = atClient.SMS;

    const result = await sms.send({
      to: [to],
      message: message,
      from: from || undefined
    });
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('SMS Error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// TwiML: Webhook for Call Setup
app.post('/api/calls/twiml', (req, res) => {
  const instructions = req.query.instructions as string || "You are a helpful AI assistant on a phone call. Be concise and professional.";
  const geminiKey = req.query.geminiKey as string || "";
  const appUrl = process.env.APP_URL || `https://${req.get('host')}`;
  const wsUrl = appUrl.replace('https://', 'wss://').replace('http://', 'ws://');

  const response = new twilio.twiml.VoiceResponse();
  const connect = response.connect();
  connect.stream({
    url: `${wsUrl}/media-stream?instructions=${encodeURIComponent(instructions)}&geminiKey=${encodeURIComponent(geminiKey)}`,
    name: 'GeminiStream'
  });
  res.type('text/xml');
  res.send(response.toString());
});

// Twilio Incoming Call Webhook
app.post('/api/calls/incoming', (req, res) => {
  const appUrl = process.env.APP_URL || `https://${req.get('host')}`;
  const wsUrl = appUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  const defaultInstructions = "You are a professional AI receptionist. Greet the caller and ask how you can help them.";

  const response = new twilio.twiml.VoiceResponse();
  const connect = response.connect();
  connect.stream({
    url: `${wsUrl}/media-stream?instructions=${encodeURIComponent(defaultInstructions)}`,
    name: 'GeminiStream'
  });
  res.type('text/xml');
  res.send(response.toString());
});

// WebSocket: Media Stream Bridge
wss.on('connection', (ws: WebSocket, req) => {
  console.log('New WebSocket connection');
  
  // Parse instructions and geminiKey from query string
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const instructions = url.searchParams.get('instructions') || "You are a helpful AI assistant on a phone call. Be concise and professional.";
  const geminiKey = url.searchParams.get('geminiKey') || process.env.GEMINI_API_KEY!;

  let streamSid: string | null = null;
  let geminiSession: any = null;

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  ws.on('message', async (message: string) => {
    const data = JSON.parse(message);

    switch (data.event) {
      case 'start':
        streamSid = data.start.streamSid;
        console.log('Stream started:', streamSid);
        
        // Initialize Gemini Live Session
        try {
          geminiSession = await ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
              responseModalities: [Modality.AUDIO],
              systemInstruction: instructions,
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
              }
            },
            callbacks: {
              onmessage: (msg) => {
                if (msg.serverContent?.modelTurn?.parts) {
                  const audioPart = msg.serverContent.modelTurn.parts.find(p => p.inlineData);
                  if (audioPart?.inlineData?.data) {
                    // Convert PCM 24kHz to Mu-Law 8kHz and send to Twilio
                    // For simplicity in this environment, we'll assume a helper or just send back
                    // In a real app, you'd use a library like `wav` or `audio-decode`
                    // Here we'll use a basic downsampling + mulaw conversion
                    const pcmData = Buffer.from(audioPart.inlineData.data, 'base64');
                    const mulawData = pcmToMulaw(pcmData, 24000, 8000);
                    
                    ws.send(JSON.stringify({
                      event: 'media',
                      streamSid,
                      media: {
                        payload: mulawData.toString('base64')
                      }
                    }));
                  }
                }
                if (msg.serverContent?.interrupted) {
                  // Handle interruption if needed
                  ws.send(JSON.stringify({ event: 'clear', streamSid }));
                }
              },
              onerror: (err) => console.error('Gemini Live Error:', err),
              onclose: () => console.log('Gemini Live Closed')
            }
          });
        } catch (err) {
          console.error('Failed to connect to Gemini:', err);
        }
        break;

      case 'media':
        if (geminiSession && data.media.payload) {
          // Convert Mu-Law 8kHz to PCM 16kHz and send to Gemini
          const mulawBuffer = Buffer.from(data.media.payload, 'base64');
          const pcm16Buffer = mulawToPcm(mulawBuffer, 8000, 16000);
          
          geminiSession.sendRealtimeInput({
            media: {
              data: pcm16Buffer.toString('base64'),
              mimeType: 'audio/pcm;rate=16000'
            }
          });
        }
        break;

      case 'stop':
        console.log('Stream stopped');
        if (geminiSession) geminiSession.close();
        break;
    }
  });

  ws.on('close', () => {
    if (geminiSession) geminiSession.close();
  });
});

// --- Audio Conversion Helpers (Basic Implementation) ---

function pcmToMulaw(pcmBuffer: Buffer, fromRate: number, toRate: number): Buffer {
  // 1. Downsample from 24000 to 8000 (every 3rd sample)
  // 2. Convert 16-bit Linear PCM to 8-bit Mu-law
  const samples = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
  const ratio = fromRate / toRate;
  const result = Buffer.alloc(Math.floor(samples.length / ratio));
  
  for (let i = 0; i < result.length; i++) {
    const sample = samples[Math.floor(i * ratio)];
    result[i] = encodeMulaw(sample);
  }
  return result;
}

function mulawToPcm(mulawBuffer: Buffer, fromRate: number, toRate: number): Buffer {
  // 1. Convert 8-bit Mu-law to 16-bit Linear PCM
  // 2. Upsample from 8000 to 16000 (linear interpolation)
  const ratio = toRate / fromRate;
  const result = Buffer.alloc(mulawBuffer.length * ratio * 2);
  const resultView = new Int16Array(result.buffer, result.byteOffset, result.length / 2);

  for (let i = 0; i < mulawBuffer.length; i++) {
    const pcm = decodeMulaw(mulawBuffer[i]);
    const nextPcm = i < mulawBuffer.length - 1 ? decodeMulaw(mulawBuffer[i+1]) : pcm;
    
    for (let j = 0; j < ratio; j++) {
      const interpolated = Math.round(pcm + (nextPcm - pcm) * (j / ratio));
      resultView[i * ratio + j] = interpolated;
    }
  }
  return result;
}

function encodeMulaw(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1);
  let mantissa = (sample >> (exponent + 3)) & 0x0f;
  let out = ~(sign | (exponent << 4) | mantissa);
  return out & 0xff;
}

function decodeMulaw(ulaw: number): number {
  ulaw = ~ulaw;
  let sign = (ulaw & 0x80);
  let exponent = (ulaw >> 4) & 0x07;
  let mantissa = ulaw & 0x0f;
  let sample = (mantissa << (exponent + 3)) + (0x84 << exponent) - 0x84;
  return sign === 0 ? sample : -sample;
}

// --- Vite Integration ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
