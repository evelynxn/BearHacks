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

export type CommandIntent =
  | 'journal_entry'
  | 'read_journal'
  | 'clear_all'
  | 'delete_latest'
  | 'delete_count'
  | 'delete_match'
  | 'ignore'
  | 'unknown';

export interface CommandClassification {
  intent: CommandIntent;
  content: string;     // journal text, match query, or count string depending on intent
  response: string;    // what Stampy says out loud
  needs_confirmation?: boolean;  // true if action is destructive (delete/clear)
}

export async function classifyCommand(transcript: string, context: string[] = []): Promise<CommandClassification> {
  const contextStr = context.length > 0
    ? `\nRecent conversation context (for reference):\n${context.map((c, i) => `${i + 1}. "${c}"`).join('\n')}\n`
    : '';

  const prompt =
    `You are Stampy, a warm personal voice journaling assistant.\n` +
    `The user just said: "${transcript}"\n` +
    contextStr +
    `Classify their intent and write a short verbal reply. You can reference prior context if needed for understanding references like "that" or "delete it".\n` +
    `Output ONLY a single raw JSON object. Start with { and end with }.\n` +
    `Schema: {"intent": "journal_entry"|"read_journal"|"clear_all"|"delete_latest"|"delete_count"|"delete_match"|"ignore"|"unknown", "content": "see rules", "response": "short warm 1-sentence reply", "needs_confirmation": boolean}\n\n` +
    `Intent rules:\n` +
    `- journal_entry: user narrating an event or experience for their journal. content = cleaned text (strip Stampy). response = MUST be "Got it, I'll write that to your journal.". needs_confirmation = false\n` +
    `- read_journal: user wants journal read. content = "". response = MUST be "One moment, let me pull up your journal.". needs_confirmation = false\n` +
    `- clear_all: delete ALL today's entries. content = "". response = MUST be "Are you sure you want to clear all of today's entries? Say yes or no.". needs_confirmation = true\n` +
    `- delete_latest: delete most recent entry. content = "". response = MUST be "I'll delete your last entry. Are you sure? Say yes or no.". needs_confirmation = true\n` +
    `- delete_count: delete N recent entries. content = number as string. response = MUST be "I'll delete your last [N] entries. Are you sure? Say yes or no." (replace [N] with the number). needs_confirmation = true\n` +
    `- delete_match: delete entries matching description. content = description. response = MUST be "I'll delete entries about [topic]. Are you sure? Say yes or no." (replace [topic] with short description). needs_confirmation = true\n` +
    `- ignore: speech is clearly NOT directed at Stampy — overheard conversation, background chatter, TV audio, or anything completely unrelated to journaling. content = "". response = "". needs_confirmation = false\n` +
    `- unknown: speech seems directed at Stampy but intent is unclear. content = "". response = MUST be "Hey! Just say Stampy followed by a journal entry, ask me to read your journal, or tell me to delete something.". needs_confirmation = false`;
  const raw = await callGemma([{ text: prompt }]);
  return parseStrictJson<CommandClassification>(raw);
}

export async function synthesizeNarrative(fragments: Array<Record<string, unknown>>): Promise<string> {
  const prompt =
    `You are writing a personal journal entry in the first person. ` +
    `Use ONLY the facts and events listed in the fragments below — do NOT add, invent, or assume anything that is not explicitly stated. ` +
    `Write in a relevant to journal writing emotion, reflective tone, under 100 words. ` +
    `Output ONLY the journal text — no headings, no bullet points, no JSON, no commentary.\n\n` +
    `Fragments: ${JSON.stringify(fragments)}`;
  return callGemma([{ text: prompt }]);
}
