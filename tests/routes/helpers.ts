import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { snaps, ensureSchema, __setDbForTesting, type Db } from "@/lib/db";
import { randomUUID } from "node:crypto";

export async function makeTestDb(): Promise<Db> {
  // Unique URL per call so parallel test files get isolated dbs.
  const url = `file:/tmp/snaptastic-test-${randomUUID()}.db`;
  const client = createClient({ url });
  const db = drizzle(client, { schema: { snaps } }) as Db;
  await ensureSchema(db);
  __setDbForTesting(db);
  return db;
}

export function resetDb(): void {
  __setDbForTesting(null);
}
