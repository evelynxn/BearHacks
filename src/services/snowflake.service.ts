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
    const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USERNAME', 'SNOWFLAKE_PASSWORD'] as const;
    for (const name of required) {
      if (!process.env[name]) {
        return reject(new SnowflakeServiceError(`${name} is not configured`, 500));
      }
    }
    const conn = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT as string,
      username: process.env.SNOWFLAKE_USERNAME as string,
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
    INSERT INTO RAW_EVENTS (USER_ID, SOURCE, RAW_TEXT, MEDIA_URL, CONTEXT_JSON, CREATED_AT)
    SELECT ?, ?, ?, ?, PARSE_JSON(?), CURRENT_TIMESTAMP()
  `;
  await execute(sql, [
    record.user_id,
    record.source,
    record.raw_text ?? null,
    record.media_url ?? null,
    JSON.stringify(record.context_json)
  ]);
}

export async function insertDailyJournal(row: DailyJournalRow): Promise<void> {
  const sql = `
    INSERT INTO DAILY_JOURNALS (USER_ID, JOURNAL_DATE, NARRATIVE, AUDIO_URL)
    VALUES (?, ?, ?, ?)
  `;
  await execute(sql, [row.user_id, row.journal_date, row.narrative, row.audio_url ?? null]);
}

export async function fetchDailyFragments(userId: string, isoDate: string): Promise<RawEventRow[]> {
  const sql = `
    SELECT USER_ID, SOURCE, RAW_TEXT, MEDIA_URL, CONTEXT_JSON, CREATED_AT
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
           SNOWFLAKE.CORTEX.SUMMARIZE(NARRATIVE) AS SUMMARY
    FROM DAILY_JOURNALS
    WHERE USER_ID = ?
      AND JOURNAL_DATE >= DATEADD(day, -?, CURRENT_DATE())
    ORDER BY JOURNAL_DATE DESC
  `;
  return execute<HistoricalSummary>(sql, [userId, safeDays]);
}
