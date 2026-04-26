import snowflake from 'snowflake-sdk';
import { DailyJournalRow, HistoricalSummary, MemoryRecord, RawEventRow } from '../types';

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
