import express, {type Express, type NextFunction, type Request, type Response, type RequestHandler} from "express";
import {createEmployeeRouter, type EmployeeRouteDependencies} from "./employees/employee.routes.js";
import {createOptimizationRouter, type OptimizationRouteDependencies} from "./optimization/optimization.routes.js";
import {createGeocodingRouter, type GeocodingRouteDependencies} from "./geocoding/geocoding.routes.js";
import {createAuthRouter} from "./auth/auth.routes.js";
import {createRequireAuth} from "./auth/auth.middleware.js";
import {DefaultAuthService} from "./auth/auth.service.js";
import type {AuthDependencies, AuthService} from "./auth/auth.types.js";
import {createGuestRouter, type GuestRouteDependencies} from "./guest/guest.routes.js";

export interface AppOptions {
  optimization?: OptimizationRouteDependencies;
  employees?: EmployeeRouteDependencies;
  geocoding?: GeocodingRouteDependencies;
  auth?: AuthDependencies;
  guest?: GuestRouteDependencies;
  frontendOrigin?: string;
  /** buildApp() turns this on for the database runtime; it is off by default (tests, local dev). */
  requireAuthentication?: boolean;
  /**
   * "unavailable" serves only /health and the guest playground: private routes
   * answer 503 without creating database or Google dependencies. Used when the
   * deployment has no DATABASE_URL (e.g. Vercel previews).
   */
  privateApi?: "enabled" | "unavailable";
}

const PRIVATE_PREFIXES = ["/employees", "/api/auth", "/api/geocoding", "/api/routes"] as const;

const privateApiUnavailable: RequestHandler = (_request, response) => {
  response.status(503).json({error: {code: "PRIVATE_API_UNAVAILABLE", message: "Login e dados da organização não estão disponíveis neste ambiente. Use o modo visitante."}});
};

/** createApp never builds infrastructure itself: services arrive injected (see buildApp). */
function resolveAuthService(options: AppOptions): AuthService | undefined {
  if (options.auth?.service) return options.auth.service;
  if (options.auth?.verifier && options.auth.repository) return new DefaultAuthService(options.auth.verifier, options.auth.repository);
  return undefined;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const frontendOrigin = options.frontendOrigin;
  if (frontendOrigin) {
    app.use((request: Request, response: Response, next: NextFunction) => {
      const origin = request.header("origin");
      if (!origin || origin === frontendOrigin) response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      response.setHeader("Access-Control-Allow-Credentials", "true");
      if (request.method === "OPTIONS") return response.sendStatus(204);
      return next();
    });
  }

  app.use(express.json());
  app.get("/", (_request, response) => response.json({message: "Employee Routes API"}));
  app.get("/health", (_request, response) => response.json({status: "ok"}));

  if (options.privateApi === "unavailable") {
    for (const prefix of PRIVATE_PREFIXES) app.use(prefix, privateApiUnavailable);
    app.use("/api/guest", createGuestRouter(options.guest));
    app.use(errorHandler);
    return app;
  }

  const authRequired = options.requireAuthentication ?? false;
  const authService = resolveAuthService(options);
  if (authService) {
    app.use("/api/auth", createAuthRouter(authService));
  }
  const authMiddleware: RequestHandler = authRequired
    ? (authService ? createRequireAuth(authService) : (_request, response) => response.status(500).json({error: {code: "AUTH_CONFIGURATION", message: "A autenticação não está configurada."}}))
    : (_request, _response, next) => next();

  // A private router without its repository answers 503 instead of inventing a store.
  app.use("/employees", authMiddleware, options.employees ? createEmployeeRouter(options.employees) : privateApiUnavailable);
  app.use("/api/geocoding", authMiddleware, createGeocodingRouter(options.geocoding));
  app.use("/api/routes", authMiddleware, options.optimization ? createOptimizationRouter(options.optimization) : privateApiUnavailable);
  app.use("/api/guest", createGuestRouter(options.guest));

  app.use(errorHandler);
  return app;
}

function errorHandler(error: unknown, _request: Request, response: Response, next: NextFunction) {
  if (response.headersSent) return next(error);
  if (error instanceof SyntaxError) return response.status(400).json({error: {code: "INVALID_JSON", message: "O corpo da requisição contém JSON inválido."}});
  console.error("UNHANDLED_REQUEST_ERROR", {error: error instanceof Error ? error.name : "unknown"});
  return response.status(500).json({error: {code: "INTERNAL_ERROR", message: "Ocorreu um erro interno."}});
}

