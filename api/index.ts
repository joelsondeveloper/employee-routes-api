import type {IncomingMessage, ServerResponse} from "node:http";
import type {Express} from "express";
import {ConfigError, loadConfig} from "../src/config/config.js";
import {buildApp} from "../src/runtime/build-app.js";

// Vercel serverless entry. vercel.json rewrites /api/*, /employees and /health
// here; Express still sees the original path in request.url.
let appPromise: Promise<Express> | undefined;

async function start(): Promise<Express> {
  const {config, warnings} = loadConfig(process.env);
  for (const warning of warnings) console.warn("CONFIG_WARNING", {warning});
  return buildApp(config);
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    appPromise ??= start();
    const app = await appPromise;
    app(request as Parameters<Express>[0], response as Parameters<Express>[1]);
  } catch (error) {
    appPromise = undefined; // retry initialization on the next request
    // Label the failure by its cause: configuration problems are not database outages.
    if (error instanceof ConfigError) console.error("STARTUP_CONFIGURATION_ERROR", {problems: error.problems});
    else console.error("STARTUP_ERROR", {error: error instanceof Error ? `${error.name}: ${error.message}` : "unknown"});
    response.statusCode = 503;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({error: {code: "SERVICE_UNAVAILABLE", message: "O servidor está indisponível no momento."}}));
  }
}
