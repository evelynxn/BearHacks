/**
 * Snowflake service for the Punchi orchestrator.
 *
 * Manages a lazy singleton connection to the PUNCHI database, exposes typed
 * helpers for the RAW_EVENTS and DAILY_JOURNALS tables, and runs a Cortex
 * SUMMARIZE() query for the weekly recap.
 *
 * Required env vars:
 *   SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD,
 *   SNOWFLAKE_DATABASE, SNOWFLAKE_WAREHOUSE
 * Optional:
 *   SNOWFLAKE_SCHEMA (default PUBLIC), SNOWFLAKE_ROLE
 */

import snowflake from 'snowflake-sdk';

type Connection = ReturnType<typeof snowflake.createConnection>;

export class SnowflakeServiceError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'SnowflakeServiceError';
  }
}

export interface RawEventRow {
  USER_ID: string;
  EVENT_TYPE: string;
  CONTENT: string;
  CREATED_AT: string;
}

export interface DailyJournalRow {
  USER_ID: string;
  JOURNAL_DATE: string;
  NARRATIVE_TEXT: string;
  AUDIO_URL: string | null;
  CREATED_AT: string;
}

const REQUIRED_ENV = [
  'SNOWFLAKE_ACCOUNT',
  'SNOWFLAKE_USER',
  'SNOWFLAKE_PASSWORD',
  'SNOWFLAKE_DATABASE',
  'SNOWFLAKE_WAREHOUSE'
] as const;

export class SnowflakeService {
  private connectionPromise: Promise<Connection> | null = null;

  private buildConnection(): Promise<Connection> {
    return new Promise((resolve, reject) => {
      for (const name of REQUIRED_ENV) {
        if (!process.env[name]) {
          return reject(new SnowflakeServiceError(`${name} is not configured`, 500));
        }
      }
      const conn = snowflake.createConnection({
        account: process.env.SNOWFLAKE_ACCOUNT as string,
        username: process.env.SNOWFLAKE_USER as string,
        password: process.env.SNOWFLAKE_PASSWORD as string,
        database: process.env.SNOWFLAKE_DATABASE,
        warehouse: process.env.SNOWFLAKE_WAREHOUSE,
        schema: process.env.SNOWFLAKE_SCHEMA ?? 'PUBLIC',
        role: process.env.SNOWFLAKE_ROLE
      });
      conn.connect((err, established) => {
        if (err) {
          return reject(
            new SnowflakeServiceError(`Snowflake connect failed: ${err.message}`, 503)
          );
        }
        resolve(established);
      });
    });
  }

  private async getConnection(): Promise<Connection> {
    if (!this.connectionPromise) {
      this.connectionPromise = this.buildConnection();
    }
    try {
      return await this.connectionPromise;
    } catch (err) {
      // Allow the next call to retry rather than caching a permanently-broken promise.
      this.connectionPromise = null;
      throw err;
    }
  }

  private async execute<T>(sqlText: string, binds: unknown[] = []): Promise<T[]> {
    const conn = await this.getConnection();
    return new Promise<T[]>((resolve, reject) => {
      conn.execute({
        sqlText,
        binds: binds as snowflake.Binds,
        complete: (err, _stmt, rows) => {
          if (err) {
            return reject(
              new SnowflakeServiceError(`Snowflake query failed: ${err.message}`)
            );
          }
          resolve((rows ?? []) as T[]);
        }
      });
    });
  }

  /** Insert one raw event (transcript, image caption, etc.). */
  async insertRawEvent(
    userId: string,
    eventType: string,
    content: string
  ): Promise<void> {
    const sql = `
      INSERT INTO RAW_EVENTS (USER_ID, EVENT_TYPE, CONTENT, CREATED_AT)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP())
    `;
    await this.execute(sql, [userId, eventType, content]);
  }

  /** Insert one daily journal row. `date` is YYYY-MM-DD. */
  async insertDailyJournal(
    userId: string,
    date: string,
    narrative: string,
    audioUrl: string
  ): Promise<void> {
    const sql = `
      INSERT INTO DAILY_JOURNALS (USER_ID, JOURNAL_DATE, NARRATIVE_TEXT, AUDIO_URL, CREATED_AT)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP())
    `;
    await this.execute(sql, [userId, date, narrative, audioUrl ?? null]);
  }

  /** Most recent N daily journals for a user, newest first. */
  async getRecentJournals(
    userId: string,
    limit: number = 7
  ): Promise<DailyJournalRow[]> {
    const safeLimit =
      Number.isInteger(limit) && limit > 0 ? Math.min(limit, 365) : 7;
    const sql = `
      SELECT USER_ID,
             TO_VARCHAR(JOURNAL_DATE) AS JOURNAL_DATE,
             NARRATIVE_TEXT,
             AUDIO_URL,
             TO_VARCHAR(CREATED_AT) AS CREATED_AT
      FROM DAILY_JOURNALS
      WHERE USER_ID = ?
      ORDER BY JOURNAL_DATE DESC
      LIMIT ?
    `;
    return this.execute<DailyJournalRow>(sql, [userId, safeLimit]);
  }

  /**
   * Synthesize the past 7 days of NARRATIVE_TEXT into a single weekly recap
   * using SNOWFLAKE.CORTEX.SUMMARIZE() in-database.
   * Returns null if the user has no journals in the window.
   */
  async summarizeWeek(userId: string): Promise<string | null> {
    const sql = `
      SELECT TO_VARCHAR(
        SNOWFLAKE.CORTEX.SUMMARIZE(
          LISTAGG(NARRATIVE_TEXT, '\n\n') WITHIN GROUP (ORDER BY JOURNAL_DATE DESC)
        ):summary
      ) AS WEEKLY_SUMMARY
      FROM DAILY_JOURNALS
      WHERE USER_ID = ?
        AND JOURNAL_DATE >= DATEADD(day, -7, CURRENT_DATE())
      HAVING COUNT(*) > 0
    `;
    const rows = await this.execute<{ WEEKLY_SUMMARY: string | null }>(sql, [userId]);
    return rows[0]?.WEEKLY_SUMMARY ?? null;
  }

  /**
   * Helper for the orchestrator's nightly synthesis flow — fetches a single
   * day's raw events so Gemma can compose the journal narrative from them.
   * (Outside the user's explicit spec but required by /api/orchestrate/summary.)
   */
  async getDailyRawEvents(userId: string, isoDate: string): Promise<RawEventRow[]> {
    const sql = `
      SELECT USER_ID,
             EVENT_TYPE,
             CONTENT,
             TO_VARCHAR(CREATED_AT) AS CREATED_AT
      FROM RAW_EVENTS
      WHERE USER_ID = ?
        AND DATE(CREATED_AT) = ?
      ORDER BY CREATED_AT ASC
    `;
    return this.execute<RawEventRow>(sql, [userId, isoDate]);
  }

  /** Tear down the singleton connection (call from graceful shutdown). */
  async destroy(): Promise<void> {
    if (!this.connectionPromise) return;
    try {
      const conn = await this.connectionPromise;
      await new Promise<void>((resolve) => {
        conn.destroy((err) => {
          if (err) console.error('[snowflake] destroy error:', err.message);
          resolve();
        });
      });
    } catch {
      // Connection never established — nothing to tear down.
    } finally {
      this.connectionPromise = null;
    }
  }
}

// Singleton — Express routes import this directly.
export const snowflakeService = new SnowflakeService();
