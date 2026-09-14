import Database from "better-sqlite3";

const database = new Database("database.sqlite");

database.exec(`
    CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL
    );
`);

export default database;