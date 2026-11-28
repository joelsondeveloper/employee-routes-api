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

test("today's production variables load without errors, warning about what step 2 will require", () => {
  const {config, warnings} = loadConfig({...production, GOOGLE_CLIENT_ID: "", VITE_GOOGLE_CLIENT_ID: "vite.apps.googleusercontent.com", SESSION_SECRET: "short"});
  assert.equal(config.database?.poolMax, 3);
  assert.equal(config.database?.caCert, undefined);
  assert.equal(config.googleClientId, "vite.apps.googleusercontent.com");
  assert.equal(warnings.length, 3);
  assert.ok(warnings.some((warning) => warning.includes("DATABASE_CA_CERT")));
  assert.ok(warnings.some((warning) => warning.includes("GOOGLE_CLIENT_ID")));
  assert.ok(warnings.some((warning) => warning.includes("SESSION_SECRET")));
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
