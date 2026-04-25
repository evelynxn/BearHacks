export interface GemmaImageContext {
  caption: string;
  entities: string[];
  location?: string;
  mood?: string;
}

export interface GemmaTextSummary {
  summary: string;
  themes: string[];
  highlights: string[];
}

export interface GemmaNarrative {
  narrative: string;
}

export type MemorySource = 'edge_audio' | 'client_image' | 'orchestrator';

export interface MemoryRecord {
  user_id: string;
  source: MemorySource;
  raw_text?: string;
  media_url?: string;
  context_json: Record<string, unknown>;
}

export interface DailyJournalRow {
  user_id: string;
  journal_date: string;
  narrative: string;
  audio_url?: string;
}

export interface HistoricalSummary {
  JOURNAL_DATE: string;
  SUMMARY: string;
}

export interface RawEventRow {
  USER_ID: string;
  SOURCE: MemorySource;
  RAW_TEXT: string | null;
  MEDIA_URL: string | null;
  CONTEXT_JSON: Record<string, unknown>;
  CREATED_AT: string;
}
