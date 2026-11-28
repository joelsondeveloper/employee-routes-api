import type {Pool} from "pg";
import type {DatabaseConfig} from "../config/config.js";
import {createPostgresPool, type PostgresTlsSummary} from "./postgres-connection.js";
import {runPostgresMigrations} from "./postgres-migrations.js";
import {PostgresAuthRepository, PostgresEmployeeRepository} from "./postgres-repositories.js";

export interface PostgresRuntime {
  pool: Pool;
  tls: PostgresTlsSummary;
  employeeRepository: PostgresEmployeeRepository;
  authRepository: PostgresAuthRepository;
}

/** One pool per process: every repository shares it. */
export async function initializePostgresRuntime(database: DatabaseConfig): Promise<PostgresRuntime> {
  const {pool, tls} = createPostgresPool(database);
  await runPostgresMigrations(pool);
  return {pool, tls, employeeRepository: new PostgresEmployeeRepository(pool), authRepository: new PostgresAuthRepository(pool)};
}
