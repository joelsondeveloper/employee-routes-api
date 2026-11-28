import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {createRequire} from "node:module";
import {createServer, type AddressInfo, type Server} from "node:net";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {after, before, test} from "node:test";
import {TLSSocket} from "node:tls";
import pg from "pg";
import {loadConfig} from "../config/config.js";
import {postgresPoolConfig} from "./postgres-connection.js";

// What a pg Client really uses after merging the connection string into the config.
const ConnectionParameters = createRequire(import.meta.url)("pg/lib/connection-parameters") as new (config: unknown) => {ssl: unknown; host: string; port: number};

const POOLER = "aws-1-ca-central-1.pooler.supabase.com";
const PEM = "-----BEGIN CERTIFICATE-----\nMIIBszCCAVmgAwIBAgIUfake\n-----END CERTIFICATE-----";
const urlWithNoVerify = `postgresql://employee_routes.ref:pw@${POOLER}:6543/postgres?sslmode=no-verify`;

test("with DATABASE_CA_CERT the final pg config verifies the CA, even if the URL says sslmode=no-verify", () => {
  const {config} = loadConfig({DATABASE_URL: urlWithNoVerify, DATABASE_CA_CERT: PEM, LOCATIONIQ_API_KEY: "k"});
  const {pool, tls} = postgresPoolConfig(config.database!);
  assert.doesNotMatch(pool.connectionString!, /ssl/i);
  const effective = new ConnectionParameters(pool);
  assert.deepEqual(effective.ssl, {ca: PEM, rejectUnauthorized: true, servername: POOLER});
  assert.equal(effective.host, POOLER);
  assert.equal(effective.port, 6543);
  assert.deepEqual(tls, {mode: "verified", servername: POOLER});
});

test("control: without stripping, pg lets sslmode=no-verify silently drop the CA", () => {
  const effective = new ConnectionParameters({connectionString: urlWithNoVerify, ssl: {ca: PEM, rejectUnauthorized: true}});
  assert.deepEqual(effective.ssl, {rejectUnauthorized: false});
});

test("without a CA (rollout step 1) the URL keeps deciding, exactly as before", () => {
  const {pool, tls} = postgresPoolConfig({url: urlWithNoVerify, poolMax: 3});
  assert.equal(pool.connectionString, urlWithNoVerify);
  assert.equal(pool.ssl, undefined);
  assert.equal(tls.mode, "url-controlled");
});

// --- Real TLS handshakes against a fake PostgreSQL server -------------------

let directory = "";
let server: Server | undefined;
let port = 0;
let trustedCa = "";
let otherCa = "";
let opensslAvailable = true;
/** Completed TLS handshakes seen by the fake server: proves success instead of inferring it. */
let secureHandshakes = 0;

function openssl(...args: string[]): void {
  execFileSync("openssl", args, {cwd: directory, stdio: "ignore"});
}

before(async () => {
  try {
    execFileSync("openssl", ["version"], {stdio: "ignore"});
  } catch {
    opensslAvailable = false;
    return;
  }
  directory = mkdtempSync(join(tmpdir(), "pg-tls-"));
  for (const name of ["ca", "other-ca"]) {
    openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", `/CN=${name}`, "-keyout", `${name}.key`, "-out", `${name}.crt`);
  }
  writeFileSync(join(directory, "san.cnf"), "subjectAltName=DNS:localhost\n");
  openssl("req", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=localhost", "-keyout", "server.key", "-out", "server.csr");
  openssl("x509", "-req", "-in", "server.csr", "-CA", "ca.crt", "-CAkey", "ca.key", "-CAcreateserial", "-days", "1", "-extfile", "san.cnf", "-out", "server.crt");
  trustedCa = readFileSync(join(directory, "ca.crt"), "utf8");
  otherCa = readFileSync(join(directory, "other-ca.crt"), "utf8");
  const key = readFileSync(join(directory, "server.key"));
  const cert = readFileSync(join(directory, "server.crt"));
  // Speaks just enough PostgreSQL: answer SSLRequest with 'S', then TLS, then hang up.
  server = createServer((socket) => {
    socket.once("data", () => {
      socket.write("S");
      const secure = new TLSSocket(socket, {isServer: true, key, cert});
      secure.on("secure", () => { secureHandshakes++; secure.destroy(); });
      secure.on("error", () => secure.destroy());
    });
    socket.on("error", () => undefined);
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

after(() => {
  server?.close();
  if (directory) rmSync(directory, {recursive: true, force: true});
});

/** Resolves with the TLS error code, or "HANDSHAKE_OK" when TLS succeeded (the fake server then hangs up). */
async function connect(config: pg.ClientConfig): Promise<string> {
  const client = new pg.Client({...config, connectionTimeoutMillis: 3_000});
  client.on("error", () => undefined);
  try {
    await client.connect();
    return "CONNECTED";
  } catch (error) {
    const code = (error as {code?: string}).code;
    return code && /CERT|SELF_SIGNED|UNABLE_TO|ALTNAME/.test(code) ? code : "HANDSHAKE_OK";
  } finally {
    await client.end().catch(() => undefined);
  }
}

test("handshake succeeds only with the right CA and hostname", async (context) => {
  if (!opensslAvailable) return context.skip("openssl not available");
  const url = (host: string) => `postgresql://u:p@${host}:${port}/db?sslmode=no-verify`;
  const before = secureHandshakes;
  assert.equal(await connect(postgresPoolConfig({url: url("localhost"), poolMax: 1, caCert: trustedCa}).pool), "HANDSHAKE_OK");
  assert.equal(secureHandshakes, before + 1, "the server completed exactly one TLS handshake");
  assert.match(await connect(postgresPoolConfig({url: url("localhost"), poolMax: 1, caCert: otherCa}).pool), /SELF_SIGNED|UNABLE_TO/);
  // 127.0.0.1 is not in the certificate's SAN: the hostname check must refuse it.
  assert.equal(await connect(postgresPoolConfig({url: url("127.0.0.1"), poolMax: 1, caCert: trustedCa}).pool), "ERR_TLS_CERT_ALTNAME_INVALID");
  assert.equal(secureHandshakes, before + 1, "rejected certificates never complete a handshake");
});

test("control: the same wrong CA is accepted if sslmode=no-verify stays in the URL", async (context) => {
  if (!opensslAvailable) return context.skip("openssl not available");
  const url = `postgresql://u:p@localhost:${port}/db?sslmode=no-verify`;
  const before = secureHandshakes;
  assert.equal(await connect({connectionString: url, ssl: {ca: otherCa, rejectUnauthorized: true}}), "HANDSHAKE_OK");
  assert.equal(secureHandshakes, before + 1, "insecure: the untrusted certificate was accepted");
});
