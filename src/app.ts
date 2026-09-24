import express, {type Express, type NextFunction, type Request, type Response, type RequestHandler} from "express";
import {createEmployeeRouter, type EmployeeRouteDependencies} from "./employees/employee.routes.js";
import {createOptimizationRouter, type OptimizationRouteDependencies} from "./optimization/optimization.routes.js";
import {createGeocodingRouter, type GeocodingRouteDependencies} from "./geocoding/geocoding.routes.js";
import {createAuthRouter} from "./auth/auth.routes.js";
import {createRequireAuth} from "./auth/auth.middleware.js";
import {DefaultAuthService} from "./auth/auth.service.js";
import {GoogleAuthService} from "./auth/google-auth.service.js";
import type {AuthDependencies, AuthService} from "./auth/auth.types.js";
import {createDefaultAuthRepository} from "./database/auth-repository.js";
import {createGuestRouter, type GuestRouteDependencies} from "./guest/guest.routes.js";

export interface AppOptions {
  optimization?: OptimizationRouteDependencies;
  employees?: EmployeeRouteDependencies;
  geocoding?: GeocodingRouteDependencies;
  auth?: AuthDependencies;
  guest?: GuestRouteDependencies;
  frontendOrigin?: string;
  /** Production enables auth by default; injected test stores remain opt-in. */
  requireAuthentication?: boolean;
}

function resolveAuthService(options: AppOptions, authRequired: boolean): AuthService | undefined {
  if (options.auth?.service) return options.auth.service;
  if (options.auth?.verifier && options.auth.repository) return new DefaultAuthService(options.auth.verifier, options.auth.repository);
  if (!authRequired) return undefined;
  try {
    return new DefaultAuthService(new GoogleAuthService(), createDefaultAuthRepository());
  } catch (error) {
    if (process.env.NODE_ENV === "production") console.error("AUTH_CONFIGURATION_ERROR", {error: error instanceof Error ? error.message : "unknown"});
    return undefined;
  }
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const frontendOrigin = options.frontendOrigin ?? process.env.FRONTEND_ORIGIN;
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

  const injectedStore = Boolean(options.employees || options.optimization || options.geocoding);
  const authRequired = options.requireAuthentication ?? (Boolean(process.env.DATABASE_URL) && !injectedStore && process.env.NODE_ENV !== "test");
  const authService = resolveAuthService(options, authRequired);
  if (authService) {
    app.use("/api/auth", createAuthRouter(authService));
  }
  const authMiddleware: RequestHandler = authRequired
    ? (authService ? createRequireAuth(authService) : (_request, response) => response.status(500).json({error: {code: "AUTH_CONFIGURATION", message: "A autenticação não está configurada."}}))
    : (_request, _response, next) => next();

  app.use("/employees", authMiddleware, createEmployeeRouter(options.employees));
  app.use("/api/geocoding", authMiddleware, createGeocodingRouter(options.geocoding));
  app.use("/api/routes", authMiddleware, createOptimizationRouter(options.optimization));
  app.use("/api/guest", createGuestRouter(options.guest));

  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    if (error instanceof SyntaxError) return response.status(400).json({error: {code: "INVALID_JSON", message: "O corpo da requisição contém JSON inválido."}});
    console.error("UNHANDLED_REQUEST_ERROR", {error: error instanceof Error ? error.name : "unknown"});
    return response.status(500).json({error: {code: "INTERNAL_ERROR", message: "Ocorreu um erro interno."}});
  });
  return app;
}

const app = createApp();
export default app;

