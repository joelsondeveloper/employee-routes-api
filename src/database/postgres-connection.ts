import {Pool, type PoolConfig} from "pg";
import type {DatabaseConfig} from "../config/config.js";

/**
 * node-postgres lets TLS parameters in the connection string override the `ssl`
 * object: with `?sslmode=no-verify` in the URL, `ssl: {ca, rejectUnauthorized:
 * true}` silently becomes `{rejectUnauthorized: false}` and the CA is dropped
 * (verified against pg 8.23). So when a CA is configured, every TLS parameter
 * is stripped from the URL and TLS is defined here, in code, only.
 */
const URL_TLS_PARAMETERS = ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey", "sslpassword", "uselibpqcompat"] as const;

export interface PostgresTlsSummary {
  mode: "verified" | "url-controlled";
  /** Host the certificate must be issued for (the Supabase pooler host). */
  servername?: string;
}

export function postgresPoolConfig(database: DatabaseConfig): {pool: PoolConfig; tls: PostgresTlsSummary} {
  const base = {max: database.poolMax, connectionTimeoutMillis: 10_000} satisfies PoolConfig;
  if (!database.caCert) {
    // Step 1 of the rollout: without a CA nothing changes (the URL decides).
    return {pool: {...base, connectionString: database.url}, tls: {mode: "url-controlled"}};
  }
  const url = new URL(database.url);
  for (const parameter of URL_TLS_PARAMETERS) url.searchParams.delete(parameter);
  return {
    pool: {
      ...base,
      connectionString: url.toString(),
      ssl: {
        ca: database.caCert,
        rejectUnauthorized: true,
        // SNI and hostname check use the host we dial: with Supabase this is the
        // shared pooler (aws-1-<region>.pooler.supabase.com), whose certificate
        // is the one presented in transaction mode on port 6543.
        servername: url.hostname,
      },
    },
    tls: {mode: "verified", servername: url.hostname},
  };
}

export function createPostgresPool(database: DatabaseConfig): {pool: Pool; tls: PostgresTlsSummary} {
  const {pool, tls} = postgresPoolConfig(database);
  return {pool: new Pool(pool), tls};
}
