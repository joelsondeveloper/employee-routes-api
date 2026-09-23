import {PostgresAuthRepository} from "./postgres-repositories.js";
import type {AuthRepository} from "./repository.types.js";

export function createDefaultAuthRepository(): AuthRepository {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for authentication.");
  return new PostgresAuthRepository();
}

