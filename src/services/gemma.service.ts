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
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
      },
      { timeout: REQUEST_TIMEOUT_MS }
    );
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new GemmaServiceError('Gemma returned empty content');
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
  try {
    return JSON.parse(stripped) as T;
  } catch {
    throw new GemmaServiceError('Gemma response was not valid JSON');
  }
}

export async function summarizeText(text: string): Promise<GemmaTextSummary> {
  const prompt = [
    "You are an introspective journaling assistant. Summarize the user's spoken transcript.",
    'Respond ONLY with strict JSON matching:',
    '{"summary": string, "themes": string[], "highlights": string[]}',
    `Transcript:\n${text}`
  ].join('\n\n');
  const raw = await callGemma([{ text: prompt }]);
  return parseStrictJson<GemmaTextSummary>(raw);
}

export async function describeImage(buffer: Buffer, mimeType: string): Promise<GemmaImageContext> {
  const prompt = [
    'Describe this photo as a memory fragment for a personal journal.',
    'Respond ONLY with strict JSON matching:',
    '{"caption": string, "entities": string[], "location"?: string, "mood"?: string}'
  ].join('\n\n');
  const raw = await callGemma([
    { text: prompt },
    { inline_data: { mime_type: mimeType, data: buffer.toString('base64') } }
  ]);
  return parseStrictJson<GemmaImageContext>(raw);
}

export async function synthesizeNarrative(fragments: Array<Record<string, unknown>>): Promise<string> {
  const prompt = [
    "You are the user's inner voice composing tonight's journal entry.",
    'Below is JSON for every captured moment from today. Write a warm, reflective 1st-person narrative under 220 words.',
    'Respond ONLY with strict JSON matching: {"narrative": string}.',
    `Fragments:\n${JSON.stringify(fragments)}`
  ].join('\n\n');
  const raw = await callGemma([{ text: prompt }]);
  return parseStrictJson<GemmaNarrative>(raw).narrative;
}
