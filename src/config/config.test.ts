import assert from "node:assert/strict";
import {test} from "node:test";
import {ConfigError, loadConfig} from "./config.js";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIBszCCAVmgAwIBAgIUfake\n-----END CERTIFICATE-----";
const production = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://employee_routes.ref:secret-password@aws-1-ca-central-1.pooler.supabase.com:6543/postgres?sslmode=no-verify",
  DATABASE_POOL_MAX: "3",
  SESSION_SECRET: "x".repeat(48),
  GOOGLE_CLIENT_ID: "client.apps.googleusercontent.com",
  LOCATIONIQ_API_KEY: "pk.test",
};

test("an empty environment boots the guest-only runtime with defaults", () => {
  const {config, warnings} = loadConfig({});
  assert.equal(config.nodeEnv, "development");
  assert.equal(config.port, 3000);
  assert.equal(config.database, undefined);
  assert.ok(warnings.some((warning) => warning.includes("LOCATIONIQ_API_KEY")));
});

test("production with a database refuses to boot without CA, GOOGLE_CLIENT_ID and a long SESSION_SECRET", () => {
  const error = (() => {
    try {
      loadConfig({...production, GOOGLE_CLIENT_ID: "", VITE_GOOGLE_CLIENT_ID: "vite.apps.googleusercontent.com", SESSION_SECRET: "short-secret"});
    } catch (caught) {
      return caught;
    }
    return undefined;
  })();
  assert.ok(error instanceof ConfigError);
  assert.equal(error.problems.length, 3);
  for (const name of ["DATABASE_CA_CERT", "GOOGLE_CLIENT_ID", "SESSION_SECRET"]) {
    assert.ok(error.problems.some((problem) => problem.startsWith(name)), `${name} reported`);
  }
  // VITE_GOOGLE_CLIENT_ID is no longer accepted as a fallback, and values never leak.
  assert.doesNotMatch(error.message, /short-secret|secret-password|vite\.apps/);
});

test("outside production the same gaps are warnings, so local development keeps working", () => {
  const {config, warnings} = loadConfig({...production, NODE_ENV: "development", GOOGLE_CLIENT_ID: "", SESSION_SECRET: ""});
  assert.equal(config.database?.poolMax, 3);
  assert.equal(config.googleClientId, undefined);
  assert.equal(warnings.length, 3);
  assert.ok(warnings.every((warning) => warning.endsWith("(mandatory in production).")));
});

test("production without a database (previews) needs none of the database secrets", () => {
  const {config, warnings} = loadConfig({NODE_ENV: "production", LOCATIONIQ_API_KEY: "pk.test"});
  assert.equal(config.database, undefined);
  assert.deepEqual(warnings, []);
});

test("a complete configuration has no warnings", () => {
  const {config, warnings} = loadConfig({...production, DATABASE_CA_CERT: PEM});
  assert.deepEqual(warnings, []);
  assert.equal(config.database?.caCert, PEM);
});

test("malformed values stop the boot and name every variable without echoing values", () => {
  const error = (() => {
    try {
      loadConfig({PORT: "http", DATABASE_URL: "mysql://root:hunter2@db/app", DATABASE_POOL_MAX: "0", DATABASE_CA_CERT: "not a pem", FRONTEND_ORIGIN: "https://app.example.com/path"});
    } catch (caught) {
      return caught;
    }
    return undefined;
  })();
  assert.ok(error instanceof ConfigError);
  for (const name of ["PORT", "DATABASE_URL", "DATABASE_POOL_MAX", "DATABASE_CA_CERT", "FRONTEND_ORIGIN"]) {
    assert.ok(error.problems.some((problem) => problem.startsWith(name)), `${name} reported`);
  }
  assert.doesNotMatch(error.message, /hunter2/);
});

test("a PEM pasted with literal \\n sequences is normalized to real line breaks", () => {
  const escaped = PEM.replace(/\n/g, "\\n");
  const {config} = loadConfig({...production, DATABASE_CA_CERT: escaped});
  assert.equal(config.database?.caCert, PEM);
});
