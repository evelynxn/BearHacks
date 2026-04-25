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
  NARRATIVE_TEXT: string;
  IS_READY: boolean;
}

export interface RawEventRow {
  USER_ID: string;
  EVENT_TYPE: string;
  CONTENT: string;
  CREATED_AT: string;
}
