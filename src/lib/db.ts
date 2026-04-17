import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { eq, sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { ResultAsync, ok, err as nerr, type Result } from "neverthrow";
import { err, type AppError } from "./errors";

export const snaps = sqliteTable("snaps", {
  snapId: text("snap_id").primaryKey(),
  imageId: text("image_id").notNull().unique(),
  originalUrl: text("original_url").notNull(),
  blurredUrl: text("blurred_url").notNull(),
  aspect: text("aspect").notNull(),
  createdAt: integer("created_at").notNull(),
});

export type SnapRow = typeof snaps.$inferSelect;
export type NewSnapRow = typeof snaps.$inferInsert;

export type Db = LibSQLDatabase<{ snaps: typeof snaps }>;

let cached: { client: Client; db: Db } | null = null;

export function getDb(): Db {
  if (cached) return cached.db;
  const url = process.env.TURSO_URL ?? "file:./local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema: { snaps } });
  cached = { client, db };
  return db;
}

/**
 * Ensure schema exists. Cheap idempotent CREATE IF NOT EXISTS — runs once per cold start.
 * For a toy app this avoids the need to run drizzle-kit migrate in prod.
 */
let ensured = false;
export async function ensureSchema(db: Db = getDb()): Promise<void> {
  if (ensured) return;
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS snaps (
      snap_id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL UNIQUE,
      original_url TEXT NOT NULL,
      blurred_url TEXT NOT NULL,
      aspect TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);
  ensured = true;
}

export function insertSnap(row: NewSnapRow, db: Db = getDb()): ResultAsync<NewSnapRow, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      await ensureSchema(db);
      await db.insert(snaps).values(row);
      return row;
    })(),
    (e) => {
      const msg = e instanceof Error ? e.message : "db insert failed";
      if (/UNIQUE|constraint/i.test(msg)) return err.collision(msg);
      return err.db(msg, e);
    },
  );
}

export function findBySnapId(snapId: string, db: Db = getDb()): ResultAsync<SnapRow, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      await ensureSchema(db);
      const rows = await db.select().from(snaps).where(eq(snaps.snapId, snapId)).limit(1);
      if (rows.length === 0) throw new Error("NOT_FOUND");
      return rows[0];
    })(),
    (e) => {
      const msg = e instanceof Error ? e.message : "db select failed";
      if (msg === "NOT_FOUND") return err.notFound(`snap ${snapId}`);
      return err.db(msg, e);
    },
  );
}

export function findByImageId(imageId: string, db: Db = getDb()): ResultAsync<SnapRow, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      await ensureSchema(db);
      const rows = await db.select().from(snaps).where(eq(snaps.imageId, imageId)).limit(1);
      if (rows.length === 0) throw new Error("NOT_FOUND");
      return rows[0];
    })(),
    (e) => {
      const msg = e instanceof Error ? e.message : "db select failed";
      if (msg === "NOT_FOUND") return err.notFound(`image ${imageId}`);
      return err.db(msg, e);
    },
  );
}

// Test seam: allow replacing the cached db (used by route unit tests).
export function __setDbForTesting(db: Db | null): void {
  if (db === null) {
    cached = null;
    ensured = false;
  } else {
    cached = { client: null as unknown as Client, db };
    ensured = false;
  }
}

// Re-export for convenience in tests.
export { ok, nerr as errResult };
export type { Result };
