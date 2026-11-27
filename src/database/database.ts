import {createRequire} from "node:module";
import type BetterSqlite3 from "better-sqlite3";

// SQLite is only a local/test fallback. Loading the native module lazily keeps
// serverless deployments (PostgreSQL only) from failing when it is absent.
const require = createRequire(import.meta.url);
let database: BetterSqlite3.Database | undefined;

export function getDatabase(): BetterSqlite3.Database {
  if (database) return database;
  const Database = require("better-sqlite3") as typeof BetterSqlite3;
  database = new Database(process.env.DATABASE_PATH ?? "database.sqlite");
  database.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL
    );
  `);
  return database;
}
