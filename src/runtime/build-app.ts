import type {Express} from "express";
import {createApp} from "../app.js";
import {DefaultAuthService} from "../auth/auth.service.js";
import {GoogleAuthService} from "../auth/google-auth.service.js";
import type {AppConfig} from "../config/config.js";
import {initializePostgresRuntime} from "../database/runtime.js";

/**
 * The only composition root. server.ts (long-running process) and api/index.ts
 * (Vercel function) are thin adapters around it, so both run the same wiring.
 */
export async function buildApp(config: AppConfig): Promise<Express> {
  const frontendOrigin = config.frontendOrigin ? {frontendOrigin: config.frontendOrigin} : {};
  if (!config.database) {
    // Previews and local runs without PostgreSQL: /health and the guest playground only.
    console.warn("PRIVATE_API_DISABLED", {reason: "DATABASE_URL is not set; serving /health and /api/guest only."});
    return createApp({privateApi: "unavailable", ...frontendOrigin});
  }
  const runtime = await initializePostgresRuntime(config.database);
  console.info("DATABASE_READY", {tls: runtime.tls.mode, ...(runtime.tls.servername ? {servername: runtime.tls.servername} : {}), poolMax: config.database.poolMax});
  // Without a Google client ID the guest mode still works; private routes answer
  // AUTH_CONFIGURATION instead of the whole API failing.
  let authService: DefaultAuthService | undefined;
  try {
    authService = new DefaultAuthService(new GoogleAuthService(config.googleClientId), runtime.authRepository, config.sessionSecret);
  } catch (error) {
    console.error("AUTH_CONFIGURATION_ERROR", {error: error instanceof Error ? error.message : "unknown"});
  }
  return createApp({
    requireAuthentication: true,
    ...(authService ? {auth: {service: authService}} : {}),
    employees: {employeeRepository: runtime.employeeRepository},
    optimization: {employeeRepository: runtime.employeeRepository},
    ...frontendOrigin,
  });
}
