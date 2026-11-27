import type {IncomingMessage, ServerResponse} from "node:http";
import type {Express} from "express";
import {createApp} from "../src/app.js";
import {DefaultAuthService} from "../src/auth/auth.service.js";
import {GoogleAuthService} from "../src/auth/google-auth.service.js";
import {initializePostgresRuntime} from "../src/database/runtime.js";

// Vercel serverless entry. vercel.json rewrites /api/*, /employees and /health
// here; Express still sees the original path in request.url.
let appPromise: Promise<Express> | undefined;

async function buildApp(): Promise<Express> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const runtime = await initializePostgresRuntime();
  return createApp({
    requireAuthentication: true,
    auth: {service: new DefaultAuthService(new GoogleAuthService(), runtime.authRepository)},
    employees: {employeeRepository: runtime.employeeRepository},
    optimization: {employeeRepository: runtime.employeeRepository},
  });
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    appPromise ??= buildApp();
    const app = await appPromise;
    app(request as Parameters<Express>[0], response as Parameters<Express>[1]);
  } catch (error) {
    appPromise = undefined; // retry initialization on the next request
    console.error("STARTUP_DATABASE_ERROR", {error: error instanceof Error ? error.message : "unknown"});
    response.statusCode = 503;
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({error: {code: "SERVICE_UNAVAILABLE", message: "O servidor está indisponível no momento."}}));
  }
}
