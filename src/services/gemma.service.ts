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
    ? `\nRecent user messages for context:\n${context.map((c, i) => `${i + 1}. "${c}"`).join('\n')}\n`
    : '';

  const prompt =
    `You are Stampy, a voice journaling assistant. Your ONLY job is to classify user speech into one intent and output JSON. Do NOT write prose or commentary.\n\n` +
    `User said: "${transcript}"\n` +
    contextStr +
    `\nOutput ONLY a raw JSON object. No markdown, no explanation. Start with { end with }.\n` +
    `Schema: {"intent": string, "content": string, "response": string, "needs_confirmation": boolean}\n\n` +
    `RULES — pick the FIRST matching intent:\n\n` +
    `1. read_journal — user wants to hear their journal ("read my journal", "what did I write today")\n` +
    `   content: ""\n` +
    `   response: "One moment, let me pull up your journal."\n` +
    `   needs_confirmation: false\n\n` +
    `2. clear_all — user wants to delete ALL entries ("clear my journal", "delete everything")\n` +
    `   content: ""\n` +
    `   response: "Are you sure you want to clear all of today's entries? Say yes or no."\n` +
    `   needs_confirmation: true\n\n` +
    `3. delete_latest — user wants to delete the last/most recent entry\n` +
    `   content: ""\n` +
    `   response: "I'll delete your last entry. Are you sure? Say yes or no."\n` +
    `   needs_confirmation: true\n\n` +
    `4. delete_count — user wants to delete N recent entries\n` +
    `   content: the number as a string (e.g. "3")\n` +
    `   response: "I'll delete your last N entries. Are you sure? Say yes or no."\n` +
    `   needs_confirmation: true\n\n` +
    `5. delete_match — user wants to delete entries about a topic\n` +
    `   content: the topic/description to match\n` +
    `   response: "I'll delete entries about [topic]. Are you sure? Say yes or no."\n` +
    `   needs_confirmation: true\n\n` +
    `6. journal_entry — user is narrating something for their journal. This is the DEFAULT if the user is describing an experience, event, feeling, or activity.\n` +
    `   content: extract the journal-worthy text. Remove meta-phrases like "write this down", "put in my journal", "can you save". Keep ONLY the life event. If unclear, use the full transcript. NEVER set content to empty string.\n` +
    `   response: "Got it, I'll write that to your journal."\n` +
    `   needs_confirmation: false\n\n` +
    `7. unknown — speech seems directed at Stampy but doesn't match any intent above\n` +
    `   content: ""\n` +
    `   response: "Just tell me about your day and I'll write it down, or ask me to read your journal."\n` +
    `   needs_confirmation: false\n\n` +
    `IMPORTANT: If the user is telling you about something they did or experienced, it is ALWAYS journal_entry. Default to journal_entry when in doubt.`;
  const raw = await callGemma([{ text: prompt }]);
  return parseStrictJson<CommandClassification>(raw);
}

export async function synthesizeNarrative(fragments: Array<Record<string, unknown>>): Promise<string> {
  const prompt =
    `You are Stampy, a friendly journaling assistant reading back the user's journal entries for the day. ` +
    `Combine the fragments below into a short, natural first-person summary of what the user did today. ` +
    `Use ONLY the facts and events listed — do NOT add, invent, or assume anything not explicitly stated. ` +
    `Keep the tone casual, warm, and upbeat — like a friend recapping your day. ` +
    `Do NOT be dramatic, poetic, melancholic, or philosophical. Just state what happened simply. ` +
    `Keep it under 80 words. ` +
    `Output ONLY the journal text — no headings, no bullet points, no JSON, no commentary.\n\n` +
    `Fragments: ${JSON.stringify(fragments)}`;
  return callGemma([{ text: prompt }]);
}
