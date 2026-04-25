import { NextFunction, Request, Response, Router } from 'express';
import multer, { MulterError } from 'multer';
import { AudioServiceError, synthesizeSpeech } from '../services/audio.service';
import {
  GemmaServiceError,
  describeImage,
  summarizeText,
  synthesizeNarrative
} from '../services/gemma.service';
import {
  SnowflakeServiceError,
  fetchDailyFragments,
  fetchDraftJournal,
  fetchHistoricalSummaries,
  insertDailyJournal,
  insertMemory,
  publishJournal,
  updateJournalNarrative,
  upsertDraftJournal
} from '../services/snowflake.service';

const router = Router();

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES }
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES }
});

class UnauthenticatedError extends Error {
  constructor() {
    super('unauthenticated');
    this.name = 'UnauthenticatedError';
  }
}

function getUserId(req: Request): string {
  // TODO: replace with Auth0 JWT middleware once Phase 2 auth lands.
  const headerValue = req.header('x-user-id');
  if (!headerValue) throw new UnauthenticatedError();
  return headerValue;
}

// Debug endpoint — writes pre-processed data to Snowflake without calling Gemma.
router.post('/debug/ingest', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { transcript, summary } = req.body;
    if (!transcript || !summary) return res.status(400).json({ error: 'transcript and summary required' });
    await insertMemory({
      user_id: userId,
      source: 'edge_audio',
      raw_text: transcript,
      context_json: summary
    });
    res.status(202).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/edge/audio', audioUpload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file required' });
    const userId = getUserId(req);
    const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript : '';
    if (!transcript.trim()) return res.status(400).json({ error: 'transcript field required' });

    const summary = await summarizeText(transcript);
    await insertMemory({
      user_id: userId,
      source: 'edge_audio',
      raw_text: transcript,
      context_json: summary as unknown as Record<string, unknown>
    });
    res.status(202).json({ ok: true, summary });
  } catch (err) {
    next(err);
  }
});

router.post('/client/image', imageUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file required' });
    const userId = getUserId(req);
    const context = await describeImage(req.file.buffer, req.file.mimetype);
    await insertMemory({
      user_id: userId,
      source: 'client_image',
      context_json: context as unknown as Record<string, unknown>
    });
    res.status(202).json({ ok: true, context });
  } catch (err) {
    next(err);
  }
});

// Preview: synthesize narrative from today's fragments, store as IS_READY=FALSE draft, return audio.
router.post('/orchestrate/preview', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate =
      typeof req.body?.date === 'string' && req.body.date.length === 10
        ? req.body.date
        : new Date().toISOString().slice(0, 10);

    const fragments = await fetchDailyFragments(userId, isoDate);
    if (fragments.length === 0) {
      return res.status(404).json({ error: 'no fragments for date' });
    }
    const narrative = await synthesizeNarrative(fragments.map(f => {
      try { return JSON.parse(f.CONTENT); } catch { return { content: f.CONTENT }; }
    }));
    const audio = await synthesizeSpeech(narrative);
    await upsertDraftJournal(userId, isoDate, narrative);

    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Punchi-Narrative', encodeURIComponent(narrative));
    res.send(audio);
  } catch (err) {
    next(err);
  }
});

// Publish: flip IS_READY=TRUE for a draft journal, return confirmation audio.
router.post('/orchestrate/publish', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate =
      typeof req.body?.date === 'string' && req.body.date.length === 10
        ? req.body.date
        : new Date().toISOString().slice(0, 10);

    const ok = await publishJournal(userId, isoDate);
    if (!ok) {
      return res.status(404).json({ error: 'no draft journal found for date' });
    }
    const confirmText =
      `Your journal for ${isoDate} has been saved. It's now saved to your dashboard.`;
    const audio = await synthesizeSpeech(confirmText);
    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Punchi-Narrative', encodeURIComponent(confirmText));
    res.send(audio);
  } catch (err) {
    next(err);
  }
});

// Legacy keep for backwards-compat — behaves like preview (draft only, no auto-publish).
router.post('/orchestrate/summary', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate =
      typeof req.body?.date === 'string' && req.body.date.length === 10
        ? req.body.date
        : new Date().toISOString().slice(0, 10);

    const fragments = await fetchDailyFragments(userId, isoDate);
    if (fragments.length === 0) {
      return res.status(404).json({ error: 'no fragments for date' });
    }
    const narrative = await synthesizeNarrative(fragments.map(f => {
      try { return JSON.parse(f.CONTENT); } catch { return { content: f.CONTENT }; }
    }));
    const audio = await synthesizeSpeech(narrative);
    await upsertDraftJournal(userId, isoDate, narrative);

    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Punchi-Narrative', encodeURIComponent(narrative));
    res.send(audio);
  } catch (err) {
    next(err);
  }
});

// TTS helper — converts arbitrary text to ElevenLabs MP3 (used by Pi for short responses).
router.post('/orchestrate/tts', async (req, res, next) => {
  try {
    getUserId(req);
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text string required' });
    }
    const audio = await synthesizeSpeech(text.slice(0, 500));
    res.set('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (err) {
    next(err);
  }
});

// Edit narrative text (web app or Pi can call this before publishing).
router.patch('/journal/:date', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const { narrative } = req.body;
    if (typeof narrative !== 'string' || !narrative.trim()) {
      return res.status(400).json({ error: 'narrative string required' });
    }
    const ok = await updateJournalNarrative(userId, isoDate, narrative);
    if (!ok) return res.status(404).json({ error: 'journal not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Get the current draft for a date (so web app can display it for editing).
router.get('/journal/:date/draft', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const draft = await fetchDraftJournal(userId, isoDate);
    if (!draft) return res.status(404).json({ error: 'no draft for date' });
    res.json(draft);
  } catch (err) {
    next(err);
  }
});

router.get('/feed', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const daysParam = Number(req.query.days ?? 30);
    const rows = await fetchHistoricalSummaries(userId, daysParam);
    res.json({ entries: rows });
  } catch (err) {
    next(err);
  }
});

router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof UnauthenticatedError) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  if (err instanceof MulterError) {
    const code = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(code).json({ error: err.message });
  }
  if (
    err instanceof GemmaServiceError ||
    err instanceof SnowflakeServiceError ||
    err instanceof AudioServiceError
  ) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error('Unhandled API error', err);
  res.status(500).json({ error: 'internal server error' });
});

export default router;
