import axios, { AxiosError } from 'axios';
import { GemmaImageContext, GemmaNarrative, GemmaTextSummary } from '../types';

const REQUEST_TIMEOUT_MS = 30_000;

export class GemmaServiceError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'GemmaServiceError';
  }
}

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

function getConfig(): { url: string; key: string } {
  const url = process.env.GEMMA_API_URL;
  const key = process.env.GEMMA_API_KEY;
  if (!url || !key) {
    throw new GemmaServiceError('Gemma API credentials are not configured', 500);
  }
  return { url, key };
}

async function callGemma(parts: GeminiPart[]): Promise<string> {
  const { url, key } = getConfig();
  try {
    const { data } = await axios.post<GeminiResponse>(
      `${url}?key=${encodeURIComponent(key)}`,
      {
        contents: [{ parts }],
        generationConfig: { temperature: 0.4 }
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new GemmaServiceError('Gemma returned empty content');
    console.log('[gemma] raw response:', text);
    return text;
  } catch (err) {
    if (err instanceof GemmaServiceError) throw err;
    const ax = err as AxiosError;
    if (ax.code === 'ECONNABORTED') throw new GemmaServiceError('Gemma request timed out', 504);
    if (ax.response?.status === 429) throw new GemmaServiceError('Gemma rate limit exceeded', 429);
    if (ax.response?.status === 401 || ax.response?.status === 403) {
      throw new GemmaServiceError('Gemma authentication failed', 502);
    }
    throw new GemmaServiceError(`Gemma request failed: ${ax.message}`);
  }
}

function parseStrictJson<T>(raw: string): T {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // Strategy 1: direct parse
  try { return JSON.parse(stripped) as T; } catch {}

  // Strategy 2: first { to last }
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const candidate = stripped.slice(start, end + 1);
    console.log('[gemma] extracted candidate:', candidate);
    try { return JSON.parse(candidate) as T; } catch (e) {
      console.log('[gemma] candidate parse error:', e);
    }
  }

  // Strategy 3: scan lines in reverse for the last line containing a JSON object
  const lines = stripped.split('\n').reverse();
  for (const line of lines) {
    const s = line.indexOf('{');
    const e = line.lastIndexOf('}');
    if (s !== -1 && e > s) {
      try { return JSON.parse(line.slice(s, e + 1)) as T; } catch {}
    }
  }

  throw new GemmaServiceError('Gemma response was not valid JSON');
}

export async function summarizeText(text: string): Promise<GemmaTextSummary> {
  const prompt =
    `You are a journaling assistant. Output ONLY a single raw JSON object — no reasoning, no bullet points, no explanation, no markdown. Start with { and end with }.\n` +
    `Schema: {"summary": string, "themes": string[], "highlights": string[]}\n` +
    `Transcript: ${text}`;
  const raw = await callGemma([{ text: prompt }]);
  return parseStrictJson<GemmaTextSummary>(raw);
}

export async function describeImage(buffer: Buffer, mimeType: string): Promise<GemmaImageContext> {
  const prompt =
    `Describe this photo as a memory fragment for a personal journal. Output ONLY a single raw JSON object — no reasoning, no bullet points, no explanation, no markdown. Start with { and end with }.\n` +
    `Schema: {"caption": string, "entities": string[], "location"?: string, "mood"?: string}`;
  const raw = await callGemma([
    { text: prompt },
    { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } }
  ]);
  return parseStrictJson<GemmaImageContext>(raw);
}

export async function synthesizeNarrative(fragments: Array<Record<string, unknown>>): Promise<string> {
  const prompt =
    `You are writing a personal journal entry in the first person. ` +
    `Use ONLY the facts and events listed in the fragments below — do NOT add, invent, or assume anything that is not explicitly stated. ` +
    `Write in a genuine, reflective tone, under 100 words. ` +
    `Output ONLY the journal text — no headings, no bullet points, no JSON, no commentary.\n\n` +
    `Fragments: ${JSON.stringify(fragments)}`;
  return callGemma([{ text: prompt }]);
}
