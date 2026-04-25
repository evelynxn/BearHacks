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
