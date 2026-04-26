import snowflake from 'snowflake-sdk';
import { DailyJournalRow, HistoricalSummary, LikeRow, MemoryRecord, RawEventRow, StampRow } from '../types';

export class SnowflakeServiceError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'SnowflakeServiceError';
  }
}

type SnowflakeConnection = ReturnType<typeof snowflake.createConnection>;

let connectionPromise: Promise<SnowflakeConnection> | null = null;

function buildConnection(): Promise<SnowflakeConnection> {
  return new Promise((resolve, reject) => {
    const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PASSWORD'] as const;
    for (const name of required) {
      if (!process.env[name]) {
        return reject(new SnowflakeServiceError(`${name} is not configured`, 500));
      }
    }
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT as string,
      username: process.env.SNOWFLAKE_USER as string,
      password: process.env.SNOWFLAKE_PASSWORD as string,
      database: process.env.SNOWFLAKE_DATABASE,
      schema: process.env.SNOWFLAKE_SCHEMA,
      warehouse: process.env.SNOWFLAKE_WAREHOUSE,
      role: process.env.SNOWFLAKE_ROLE
    });
    conn.connect((err, established) => {
      if (err) {
        connectionPromise = null;
        return reject(new SnowflakeServiceError(`Snowflake connect failed: ${err.message}`, 503));
      }
      resolve(established);
    });
  });
}

function getConnection(): Promise<SnowflakeConnection> {
  if (!connectionPromise) connectionPromise = buildConnection();
  return connectionPromise;
}

async function execute<T>(sqlText: string, binds: unknown[] = []): Promise<T[]> {
  const conn = await getConnection();
  return new Promise<T[]>((resolve, reject) => {
    conn.execute({
      sqlText,
      binds: binds as snowflake.Binds,
      complete: (err, _stmt, rows) => {
        if (err) return reject(new SnowflakeServiceError(`Snowflake query failed: ${err.message}`));
        resolve((rows ?? []) as T[]);
      }
    });
  });
}

export async function insertMemory(record: MemoryRecord): Promise<void> {
  const sql = `
    INSERT INTO RAW_EVENTS (USER_ID, EVENT_TYPE, CONTENT)
    VALUES (?, ?, ?)
  `;
  await execute(sql, [
    record.user_id,
    record.source,
    JSON.stringify({ raw_text: record.raw_text ?? null, context: record.context_json })
  ]);
}

export async function insertDailyJournal(row: DailyJournalRow): Promise<void> {
  const sql = `
    INSERT INTO DAILY_JOURNALS (USER_ID, JOURNAL_DATE, NARRATIVE_TEXT, AUDIO_URL, IS_READY)
    VALUES (?, ?, ?, ?, FALSE)
  `;
  await execute(sql, [row.user_id, row.journal_date, row.narrative, row.audio_url ?? null]);
}

export async function upsertDraftJournal(userId: string, isoDate: string, narrative: string): Promise<void> {
  // Insert if no row exists for this date; update narrative if draft (IS_READY=FALSE) already exists.
  const existing = await execute<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM DAILY_JOURNALS WHERE USER_ID = ? AND JOURNAL_DATE = ?`,
    [userId, isoDate]
  );
  if ((existing[0]?.CNT ?? 0) > 0) {
    await execute(
      `UPDATE DAILY_JOURNALS SET NARRATIVE_TEXT = ?
       WHERE USER_ID = ? AND JOURNAL_DATE = ? AND IS_READY = FALSE`,
      [narrative, userId, isoDate]
    );
  } else {
    await execute(
      `INSERT INTO DAILY_JOURNALS (USER_ID, JOURNAL_DATE, NARRATIVE_TEXT, IS_READY) VALUES (?, ?, ?, FALSE)`,
      [userId, isoDate, narrative]
    );
  }
}

export async function publishJournal(userId: string, isoDate: string): Promise<boolean> {
  const rows = await execute<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM DAILY_JOURNALS WHERE USER_ID = ? AND JOURNAL_DATE = ? AND IS_READY = FALSE`,
    [userId, isoDate]
  );
  if ((rows[0]?.CNT ?? 0) === 0) return false;
  await execute(
    `UPDATE DAILY_JOURNALS SET IS_READY = TRUE
     WHERE USER_ID = ? AND JOURNAL_DATE = ?`,
    [userId, isoDate]
  );
  return true;
}

export async function updateJournalNarrative(userId: string, isoDate: string, narrative: string): Promise<boolean> {
  const rows = await execute<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM DAILY_JOURNALS WHERE USER_ID = ? AND JOURNAL_DATE = ?`,
    [userId, isoDate]
  );
  if ((rows[0]?.CNT ?? 0) === 0) return false;
  await execute(
    `UPDATE DAILY_JOURNALS SET NARRATIVE_TEXT = ?
     WHERE USER_ID = ? AND JOURNAL_DATE = ?`,
    [narrative, userId, isoDate]
  );
  return true;
}

export async function fetchDraftJournal(userId: string, isoDate: string): Promise<{ narrative: string } | null> {
  const rows = await execute<{ NARRATIVE_TEXT: string }>(
    `SELECT NARRATIVE_TEXT FROM DAILY_JOURNALS WHERE USER_ID = ? AND JOURNAL_DATE = ? AND IS_READY = FALSE`,
    [userId, isoDate]
  );
  return rows.length > 0 ? { narrative: rows[0].NARRATIVE_TEXT } : null;
}

export async function deleteLatestFragment(userId: string, isoDate: string): Promise<boolean> {
  const rows = await execute<{ ID: string }>(
    `SELECT ID FROM RAW_EVENTS WHERE USER_ID = ? AND DATE(CREATED_AT) = ? ORDER BY CREATED_AT DESC LIMIT 1`,
    [userId, isoDate]
  );
  if (rows.length === 0) return false;
  await execute(`DELETE FROM RAW_EVENTS WHERE ID = ?`, [rows[0].ID]);
  return true;
}

export async function deleteFragmentsByCount(userId: string, isoDate: string, count: number): Promise<number> {
  const safeCount = Math.max(1, Math.floor(count));
  const rows = await execute<{ ID: string }>(
    `SELECT ID FROM RAW_EVENTS WHERE USER_ID = ? AND DATE(CREATED_AT) = ? ORDER BY CREATED_AT DESC LIMIT ?`,
    [userId, isoDate, safeCount]
  );
  if (rows.length === 0) return 0;
  const ids = rows.map(r => r.ID);
  await execute(
    `DELETE FROM RAW_EVENTS WHERE ID IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  return ids.length;
}

export async function deleteFragmentsByMatch(userId: string, isoDate: string, query: string): Promise<number> {
  // Case-insensitive substring match on CONTENT
  const rows = await execute<{ ID: string }>(
    `SELECT ID FROM RAW_EVENTS WHERE USER_ID = ? AND DATE(CREATED_AT) = ? AND LOWER(CONTENT) LIKE LOWER(?)`,
    [userId, isoDate, `%${query}%`]
  );
  if (rows.length === 0) return 0;
  const ids = rows.map(r => r.ID);
  await execute(
    `DELETE FROM RAW_EVENTS WHERE ID IN (${ids.map(() => '?').join(',')})`,
    ids
  );
  return ids.length;
}

export async function clearDailyFragments(userId: string, isoDate: string): Promise<number> {
  const rows = await execute<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM RAW_EVENTS WHERE USER_ID = ? AND DATE(CREATED_AT) = ?`,
    [userId, isoDate]
  );
  const count = rows[0]?.CNT ?? 0;
  await execute(
    `DELETE FROM RAW_EVENTS WHERE USER_ID = ? AND DATE(CREATED_AT) = ?`,
    [userId, isoDate]
  );
  return count;
}

export async function deleteFragment(userId: string, fragmentId: string): Promise<boolean> {
  const rows = await execute<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM RAW_EVENTS WHERE USER_ID = ? AND ID = ?`,
    [userId, fragmentId]
  );
  if ((rows[0]?.CNT ?? 0) === 0) return false;
  await execute(`DELETE FROM RAW_EVENTS WHERE USER_ID = ? AND ID = ?`, [userId, fragmentId]);
  return true;
}

export async function updateFragmentContent(userId: string, fragmentId: string, rawText: string): Promise<boolean> {
  const rows = await execute<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM RAW_EVENTS WHERE USER_ID = ? AND ID = ?`,
    [userId, fragmentId]
  );
  if ((rows[0]?.CNT ?? 0) === 0) return false;
  await execute(
    `UPDATE RAW_EVENTS SET CONTENT = ? WHERE USER_ID = ? AND ID = ?`,
    [JSON.stringify({ raw_text: rawText }), userId, fragmentId]
  );
  return true;
}

export async function fetchDailyFragments(userId: string, isoDate: string): Promise<RawEventRow[]> {
  const sql = `
    SELECT USER_ID, EVENT_TYPE, CONTENT, CREATED_AT
    FROM RAW_EVENTS
    WHERE USER_ID = ? AND DATE(CREATED_AT) = ?
    ORDER BY CREATED_AT ASC
  `;
  return execute<RawEventRow>(sql, [userId, isoDate]);
}

export async function fetchHistoricalSummaries(userId: string, days: number): Promise<HistoricalSummary[]> {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;
  const sql = `
    SELECT TO_VARCHAR(JOURNAL_DATE) AS JOURNAL_DATE,
           NARRATIVE_TEXT,
           IS_READY
    FROM DAILY_JOURNALS
    WHERE USER_ID = ?
      AND JOURNAL_DATE >= DATEADD(day, -?, CURRENT_DATE())
      AND IS_READY = TRUE
    ORDER BY JOURNAL_DATE DESC
  `;
  return execute<HistoricalSummary>(sql, [userId, safeDays]);
}

// ── Stamps ────────────────────────────────────────────────────────────

export async function insertStamp(userId: string, imageUrl: string, label: string): Promise<void> {
  await execute(
    `INSERT INTO USER_STAMPS (USER_ID, IMAGE_URL, LABEL) VALUES (?, ?, ?)`,
    [userId, imageUrl, label]
  );
}

export async function fetchUserStamps(userId: string): Promise<StampRow[]> {
  return execute<StampRow>(
    `SELECT ID, USER_ID, IMAGE_URL, LABEL, CREATED_AT FROM USER_STAMPS WHERE USER_ID = ? ORDER BY CREATED_AT DESC`,
    [userId]
  );
}

export async function deleteStamp(userId: string, stampId: string): Promise<boolean> {
  const rows = await execute<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM USER_STAMPS WHERE USER_ID = ? AND ID = ?`,
    [userId, stampId]
  );
  if ((rows[0]?.CNT ?? 0) === 0) return false;
  await execute(`DELETE FROM USER_STAMPS WHERE USER_ID = ? AND ID = ?`, [userId, stampId]);
  return true;
}

// ── Likes ─────────────────────────────────────────────────────────────

export async function insertLike(userId: string, targetUserId: string, targetDate: string): Promise<void> {
  const existing = await execute<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM USER_LIKES WHERE USER_ID = ? AND TARGET_USER_ID = ? AND TARGET_JOURNAL_DATE = ?`,
    [userId, targetUserId, targetDate]
  );
  if ((existing[0]?.CNT ?? 0) > 0) return; // already liked
  await execute(
    `INSERT INTO USER_LIKES (USER_ID, TARGET_USER_ID, TARGET_JOURNAL_DATE) VALUES (?, ?, ?)`,
    [userId, targetUserId, targetDate]
  );
}

export async function removeLike(userId: string, targetUserId: string, targetDate: string): Promise<void> {
  await execute(
    `DELETE FROM USER_LIKES WHERE USER_ID = ? AND TARGET_USER_ID = ? AND TARGET_JOURNAL_DATE = ?`,
    [userId, targetUserId, targetDate]
  );
}

export async function fetchUserLikes(userId: string): Promise<LikeRow[]> {
  return execute<LikeRow>(
    `SELECT USER_ID, TARGET_USER_ID, TARGET_JOURNAL_DATE, CREATED_AT FROM USER_LIKES WHERE USER_ID = ? ORDER BY CREATED_AT DESC`,
    [userId]
  );
}

// ── Profile stamp slots ───────────────────────────────────────────────

export async function setProfileSlot(userId: string, slotIndex: number, stampId: string): Promise<void> {
  const existing = await execute<{ CNT: number }>(
    `SELECT COUNT(*) AS CNT FROM PROFILE_SLOTS WHERE USER_ID = ? AND SLOT_INDEX = ?`,
    [userId, slotIndex]
  );
  if ((existing[0]?.CNT ?? 0) > 0) {
    await execute(
      `UPDATE PROFILE_SLOTS SET STAMP_ID = ? WHERE USER_ID = ? AND SLOT_INDEX = ?`,
      [stampId, userId, slotIndex]
    );
  } else {
    await execute(
      `INSERT INTO PROFILE_SLOTS (USER_ID, SLOT_INDEX, STAMP_ID) VALUES (?, ?, ?)`,
      [userId, slotIndex, stampId]
    );
  }
}

export async function fetchProfileSlots(userId: string): Promise<Array<{ SLOT_INDEX: number; STAMP_ID: string; IMAGE_URL: string }>> {
  return execute<{ SLOT_INDEX: number; STAMP_ID: string; IMAGE_URL: string }>(
    `SELECT ps.SLOT_INDEX, ps.STAMP_ID, us.IMAGE_URL
     FROM PROFILE_SLOTS ps
     JOIN USER_STAMPS us ON ps.STAMP_ID = us.ID
     WHERE ps.USER_ID = ?
     ORDER BY ps.SLOT_INDEX ASC`,
    [userId]
  );
}
