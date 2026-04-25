import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export class AudioServiceError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'AudioServiceError';
  }
}

let client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (client) return client;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new AudioServiceError('ELEVENLABS_API_KEY is not configured', 500);
  client = new ElevenLabsClient({ apiKey });
  return client;
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const trimmed = text.trim();
  if (!trimmed) throw new AudioServiceError('Cannot synthesize empty text', 400);

  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) throw new AudioServiceError('ELEVENLABS_VOICE_ID is not configured', 500);
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? 'eleven_multilingual_v2';

  try {
    const stream = await getClient().textToSpeech.convert(voiceId, {
      text: trimmed,
      modelId
    });
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) throw new AudioServiceError('ElevenLabs returned empty audio');
    return Buffer.concat(chunks);
  } catch (err) {
    if (err instanceof AudioServiceError) throw err;
    const e = err as Error & { statusCode?: number };
    if (e.statusCode === 429) throw new AudioServiceError('ElevenLabs rate limit exceeded', 429);
    if (e.statusCode === 401 || e.statusCode === 403) {
      throw new AudioServiceError('ElevenLabs authentication failed', 502);
    }
    throw new AudioServiceError(`ElevenLabs synthesis failed: ${e.message}`);
  }
}
