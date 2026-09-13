import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "sanaachilga.db");

const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "schema.sql");

declare global {
  // eslint-disable-next-line no-var
  var __sanaachilgaDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__sanaachilgaDb) {
    globalThis.__sanaachilgaDb = open();
  }
  return globalThis.__sanaachilgaDb;
}

type Params = (string | number | null | bigint | Uint8Array)[];

export function all<T = Record<string, unknown>>(sql: string, ...p: Params): T[] {
  return getDb().prepare(sql).all(...p) as T[];
}

export function one<T = Record<string, unknown>>(sql: string, ...p: Params): T | undefined {
  return getDb().prepare(sql).get(...p) as T | undefined;
}

export function run(sql: string, ...p: Params) {
  return getDb().prepare(sql).run(...p);
}

export function nowIso() {
  return new Date().toISOString();
}

export function audit(
  actorName: string,
  action: string,
  entity: string,
  entityId: number | null,
  detail = ""
) {
  run(
    `INSERT INTO audit_log (actor_name, action, entity, entity_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    actorName,
    action,
    entity,
    entityId,
    detail,
    nowIso()
  );
}
