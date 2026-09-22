import Database from "better-sqlite3";

const database = new Database(process.env.DATABASE_PATH ?? "database.sqlite");

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

export default database;
