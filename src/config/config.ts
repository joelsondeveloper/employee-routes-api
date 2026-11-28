import {z} from "zod";

/**
 * Single source of runtime configuration, validated once at boot.
 *
 * Errors stop the boot and name the variable (never its value):
 * - values that can never work (a non-numeric PORT, a malformed URL or PEM);
 * - in production with a database: no DATABASE_CA_CERT (unverified TLS), no
 *   GOOGLE_CLIENT_ID, or a SESSION_SECRET shorter than 32 characters.
 * Outside production those three are warnings, so local development and tests
 * keep working without secrets.
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

  const googleClientId = values.GOOGLE_CLIENT_ID;
  if (values.DATABASE_URL) {
    const required: string[] = [];
    if (!values.DATABASE_CA_CERT) required.push("DATABASE_CA_CERT is required: without it the database certificate is not verified");
    if (!googleClientId) required.push("GOOGLE_CLIENT_ID is required: without it nobody can sign in");
    if (!values.SESSION_SECRET || values.SESSION_SECRET.length < SESSION_SECRET_MIN_LENGTH) {
      required.push(`SESSION_SECRET is required with at least ${SESSION_SECRET_MIN_LENGTH} characters`);
    }
    if (values.NODE_ENV === "production" && required.length) throw new ConfigError(required);
    warnings.push(...required.map((problem) => `${problem} (mandatory in production).`));
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
