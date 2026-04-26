import { NextFunction, Request, Response, Router } from 'express';
import multer, { MulterError } from 'multer';
import { AudioServiceError, synthesizeSpeech } from '../services/audio.service';
import {
  GemmaServiceError,
  classifyCommand,
  describeImage,
  summarizeText,
  synthesizeNarrative
} from '../services/gemma.service';
import {
  SnowflakeServiceError,
  clearDailyFragments,
  deleteFragment,
  deleteFragmentsByCount,
  deleteFragmentsByMatch,
  deleteLatestFragment,
  deleteStamp,
  fetchDailyFragments,
  fetchDraftJournal,
  fetchHistoricalSummaries,
  fetchProfileSlots,
  fetchUserLikes,
  fetchUserStamps,
  insertDailyJournal,
  insertLike,
  insertMemory,
  insertStamp,
  publishJournal,
  removeLike,
  setProfileSlot,
  updateFragmentContent,
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

// Preview: synthesize narrative from today's fragments and return audio. Does NOT write to DB.
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

    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Punchi-Narrative', encodeURIComponent(narrative));
    res.send(audio);
  } catch (err) {
    next(err);
  }
});

// Publish: re-synthesize narrative, write to DAILY_JOURNALS as IS_READY=TRUE, return confirmation audio.
router.post('/orchestrate/publish', async (req, res, next) => {
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
    await upsertDraftJournal(userId, isoDate, narrative);
    await publishJournal(userId, isoDate);

    const confirmText = `Your journal for ${isoDate} has been saved. It's now ready on your dashboard.`;
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

// Gemma-powered command classification — atomic intent detection.
// Returns ElevenLabs audio of Stampy's verbal response + intent header.
router.post('/orchestrate/command', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const transcript: string = req.body?.transcript ?? '';
    const context: string[] = Array.isArray(req.body?.context) ? req.body.context : [];
    const isoDate =
      typeof req.body?.date === 'string' && req.body.date.length === 10
        ? req.body.date
        : new Date().toISOString().slice(0, 10);

    if (!transcript.trim()) return res.status(400).json({ error: 'transcript required' });

    const { intent, content, response, needs_confirmation } = await classifyCommand(transcript, context);

    // Execute intent immediately UNLESS it needs confirmation (destructive actions)
    if (!needs_confirmation) {
      switch (intent) {
        case 'journal_entry': {
          // Use classified content if available, otherwise fall back to original transcript
          const journalText = content.trim() || transcript.trim();
          if (journalText) {
            const summary = await summarizeText(journalText);
            await insertMemory({ user_id: userId, source: 'edge_audio', raw_text: journalText, context_json: summary as unknown as Record<string, unknown> });
          }
          break;
        }
        // read_journal, delete_latest (needs confirm), clear_all (needs confirm), delete_count (needs confirm), delete_match (needs confirm), unknown: no DB action
      }
    }

    const audio = await synthesizeSpeech(response || 'Got it.');
    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Punchi-Intent', intent);
    res.set('X-Punchi-Needs-Confirm', needs_confirmation ? 'true' : 'false');
    res.set('X-Punchi-Content', encodeURIComponent(content));
    res.send(audio);
  } catch (err) {
    next(err);
  }
});

// Delete latest fragment for a date.
router.delete('/fragments/:date/latest', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const ok = await deleteLatestFragment(userId, isoDate);
    if (!ok) return res.status(404).json({ error: 'no fragments for date' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// List all fragments for a date (web app fragment manager).
router.get('/fragments/:date', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const fragments = await fetchDailyFragments(userId, isoDate);
    res.json({ fragments });
  } catch (err) {
    next(err);
  }
});

// Clear all fragments for today (voice command: "stampi clear my journal").
router.delete('/fragments/:date', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const count = await clearDailyFragments(userId, isoDate);
    res.json({ ok: true, deleted: count });
  } catch (err) {
    next(err);
  }
});

// Delete a single fragment.
router.delete('/fragments/:date/:id', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const ok = await deleteFragment(userId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'fragment not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Delete N most recent fragments (called after confirmation).
router.post('/fragments/:date/delete-count', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const { count } = req.body;
    if (typeof count !== 'number' || count < 1) {
      return res.status(400).json({ error: 'count must be a positive number' });
    }
    const deleted = await deleteFragmentsByCount(userId, isoDate, count);
    res.json({ ok: true, deleted });
  } catch (err) {
    next(err);
  }
});

// Delete fragments matching description (called after confirmation).
router.post('/fragments/:date/delete-match', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const { query } = req.body;
    if (typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'query string required' });
    }
    const deleted = await deleteFragmentsByMatch(userId, isoDate, query);
    res.json({ ok: true, deleted });
  } catch (err) {
    next(err);
  }
});

// Edit a single fragment's text.
router.patch('/fragments/:date/:id', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text string required' });
    }
    const ok = await updateFragmentContent(userId, req.params.id, text);
    if (!ok) return res.status(404).json({ error: 'fragment not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Stamps ────────────────────────────────────────────────────────────

// Save a new stamp (image upload + cutout). Returns the stamp record.
router.post('/stamps', imageUpload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file required' });
    const userId = getUserId(req);
    // Use Gemma to generate a summary/label of the image contents
    let label = 'Untitled';
    try {
      const context = await describeImage(req.file.buffer, req.file.mimetype);
      label = context.caption || 'Untitled';
    } catch {
      // Gemma unavailable — fall back to user-provided label or 'Untitled'
      label = typeof req.body?.label === 'string' ? req.body.label : 'Untitled';
    }
    // Store image as base64 data URI for simplicity (production: upload to S3/GCS)
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await insertStamp(userId, dataUri, label);
    res.status(201).json({ ok: true, image_url: dataUri, label });
  } catch (err) {
    next(err);
  }
});

// List user's stamps.
router.get('/stamps', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const stamps = await fetchUserStamps(userId);
    res.json({ stamps });
  } catch (err) {
    next(err);
  }
});

// Delete a stamp.
router.delete('/stamps/:id', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const ok = await deleteStamp(userId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'stamp not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Likes ─────────────────────────────────────────────────────────────

router.post('/likes', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { target_user_id, target_date } = req.body;
    if (!target_user_id || !target_date) return res.status(400).json({ error: 'target_user_id and target_date required' });
    await insertLike(userId, target_user_id, target_date);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/likes', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { target_user_id, target_date } = req.body;
    if (!target_user_id || !target_date) return res.status(400).json({ error: 'target_user_id and target_date required' });
    await removeLike(userId, target_user_id, target_date);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/likes', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const likes = await fetchUserLikes(userId);
    res.json({ likes });
  } catch (err) {
    next(err);
  }
});

// ── Profile slots ─────────────────────────────────────────────────────

router.get('/profile/slots', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const slots = await fetchProfileSlots(userId);
    res.json({ slots });
  } catch (err) {
    next(err);
  }
});

router.put('/profile/slots/:index', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const slotIndex = parseInt(req.params.index, 10);
    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex > 6) return res.status(400).json({ error: 'slot index must be 0-6' });
    const { stamp_id } = req.body;
    if (!stamp_id) return res.status(400).json({ error: 'stamp_id required' });
    await setProfileSlot(userId, slotIndex, stamp_id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Feed ──────────────────────────────────────────────────────────────

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
