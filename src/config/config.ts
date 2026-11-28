import {z} from "zod";

/**
 * Single source of runtime configuration, validated once at boot.
 *
 * Errors are values that can never work (a non-numeric PORT, a malformed URL or
 * PEM): boot stops and names the variable. Warnings are settings that work today
 * but will become mandatory in a later rollout step (P0-3 step 2): they are
 * logged on every cold start so they cannot go unnoticed.
 */
export interface DatabaseConfig {
  url: string;
  poolMax: number;
  /** PEM of the CA that signs the Supabase pooler certificate. */
  caCert?: string;
}

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  /** Absent: the API serves only /health and the guest playground. */
  database?: DatabaseConfig;
  googleClientId?: string;
  sessionSecret?: string;
  frontendOrigin?: string;
  locationIqConfigured: boolean;
}

export interface LoadedConfig {
  config: AppConfig;
  warnings: string[];
}

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration: ${problems.join("; ")}`);
    this.name = "ConfigError";
  }
}

const SESSION_SECRET_MIN_LENGTH = 32;
const PEM_CERTIFICATE = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/;

const optionalText = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().optional());

const schema = z.object({
  NODE_ENV: z.preprocess((value) => value || "development", z.enum(["development", "test", "production"])),
  PORT: z.preprocess((value) => value || "3000", z.coerce.number().int().min(1).max(65_535)),
  DATABASE_URL: optionalText.refine((value) => value === undefined || isPostgresUrl(value), "must be a postgres:// or postgresql:// URL"),
  DATABASE_POOL_MAX: z.preprocess((value) => value || "10", z.coerce.number().int().min(1).max(50)),
  DATABASE_CA_CERT: optionalText.refine((value) => value === undefined || PEM_CERTIFICATE.test(value), "must be a PEM certificate (-----BEGIN CERTIFICATE-----)"),
  GOOGLE_CLIENT_ID: optionalText,
  VITE_GOOGLE_CLIENT_ID: optionalText,
  SESSION_SECRET: optionalText,
  FRONTEND_ORIGIN: optionalText.refine((value) => value === undefined || isOrigin(value), "must be an origin such as https://app.example.com"),
  LOCATIONIQ_API_KEY: optionalText,
});

function isPostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "postgres:" || url.protocol === "postgresql:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function isOrigin(value: string): boolean {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

/**
 * Vercel and some editors store multi-line secrets with literal "\n". Accept both
 * real line breaks and escaped ones so the PEM reaches Node intact.
 */
export function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): LoadedConfig {
  const caCertRaw = env.DATABASE_CA_CERT ? normalizePem(env.DATABASE_CA_CERT) : env.DATABASE_CA_CERT;
  const parsed = schema.safeParse({...env, DATABASE_CA_CERT: caCertRaw});
  if (!parsed.success) {
    // Names and reasons only: values may be secrets.
    throw new ConfigError(parsed.error.issues.map((issue) => `${issue.path.join(".") || "env"} ${issue.message}`));
  }
  const values = parsed.data;
  const warnings: string[] = [];

  const googleClientId = values.GOOGLE_CLIENT_ID ?? values.VITE_GOOGLE_CLIENT_ID;
  if (values.DATABASE_URL) {
    if (!values.DATABASE_CA_CERT) {
      warnings.push("DATABASE_CA_CERT is not set: the database certificate is not verified (P0-3 step 2 will require it).");
    }
    if (!values.GOOGLE_CLIENT_ID && values.VITE_GOOGLE_CLIENT_ID) {
      warnings.push("GOOGLE_CLIENT_ID is not set: falling back to VITE_GOOGLE_CLIENT_ID (step 2 will require GOOGLE_CLIENT_ID).");
    }
    if (!googleClientId) warnings.push("No Google client ID: private routes will answer AUTH_CONFIGURATION.");
    if (!values.SESSION_SECRET) {
      warnings.push("SESSION_SECRET is not set: sessions fall back to the 1-hour Google ID token.");
    } else if (values.SESSION_SECRET.length < SESSION_SECRET_MIN_LENGTH) {
      warnings.push(`SESSION_SECRET is shorter than ${SESSION_SECRET_MIN_LENGTH} characters (step 2 will require at least ${SESSION_SECRET_MIN_LENGTH}).`);
    }
  }
  if (!values.LOCATIONIQ_API_KEY) warnings.push("LOCATIONIQ_API_KEY is not set: geocoding and route optimization will fail.");

  const config: AppConfig = {
    nodeEnv: values.NODE_ENV,
    port: values.PORT,
    locationIqConfigured: Boolean(values.LOCATIONIQ_API_KEY),
    ...(values.DATABASE_URL ? {database: {url: values.DATABASE_URL, poolMax: values.DATABASE_POOL_MAX, ...(values.DATABASE_CA_CERT ? {caCert: values.DATABASE_CA_CERT} : {})}} : {}),
    ...(googleClientId ? {googleClientId} : {}),
    ...(values.SESSION_SECRET ? {sessionSecret: values.SESSION_SECRET} : {}),
    ...(values.FRONTEND_ORIGIN ? {frontendOrigin: values.FRONTEND_ORIGIN} : {}),
  };
  return {config, warnings};
}
