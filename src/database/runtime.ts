import type {Pool} from "pg";
import {runPostgresMigrations} from "./postgres-migrations.js";
import {createPostgresPool, PostgresAuthRepository, PostgresEmployeeRepository} from "./postgres-repositories.js";

export async function initializePostgresRuntime(): Promise<{pool: Pool; employeeRepository: PostgresEmployeeRepository; authRepository: PostgresAuthRepository}> {
  const pool = createPostgresPool();
  await runPostgresMigrations(pool);
  return {pool, employeeRepository: new PostgresEmployeeRepository(pool), authRepository: new PostgresAuthRepository(pool)};
}

