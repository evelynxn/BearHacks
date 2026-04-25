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
  snowflakeService
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

router.post('/edge/audio', audioUpload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'audio file required' });
    const userId = getUserId(req);
    const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript : '';
    if (!transcript.trim()) return res.status(400).json({ error: 'transcript field required' });

    const summary = await summarizeText(transcript);
    await snowflakeService.insertRawEvent(
      userId,
      'edge_audio',
      JSON.stringify({ transcript, summary })
    );
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
    await snowflakeService.insertRawEvent(
      userId,
      'client_image',
      JSON.stringify(context)
    );
    res.status(202).json({ ok: true, context });
  } catch (err) {
    next(err);
  }
});

router.post('/orchestrate/summary', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const isoDate =
      typeof req.body?.date === 'string' && req.body.date.length === 10
        ? req.body.date
        : new Date().toISOString().slice(0, 10);

    const events = await snowflakeService.getDailyRawEvents(userId, isoDate);
    if (events.length === 0) {
      return res.status(404).json({ error: 'no events for date' });
    }

    const fragments = events.map((e) => {
      try {
        return JSON.parse(e.CONTENT);
      } catch {
        return { event_type: e.EVENT_TYPE, raw: e.CONTENT };
      }
    });
    const narrative = await synthesizeNarrative(fragments);
    const audio = await synthesizeSpeech(narrative);
    // TODO: upload audio to Vultr Object Storage and persist the public URL here.
    await snowflakeService.insertDailyJournal(userId, isoDate, narrative, '');

    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Punchi-Narrative', encodeURIComponent(narrative));
    res.send(audio);
  } catch (err) {
    next(err);
  }
});

router.get('/feed', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const limitParam = Number(req.query.limit ?? 7);
    const rows = await snowflakeService.getRecentJournals(userId, limitParam);
    res.json({ entries: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/feed/weekly', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const summary = await snowflakeService.summarizeWeek(userId);
    res.json({ summary });
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
