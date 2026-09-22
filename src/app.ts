import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createEmployeeRouter, type EmployeeRouteDependencies } from "./employees/employee.routes.js";
import { createOptimizationRouter, type OptimizationRouteDependencies } from "./optimization/optimization.routes.js";
import { createGeocodingRouter, type GeocodingRouteDependencies } from "./geocoding/geocoding.routes.js";

export interface AppOptions {
  optimization?: OptimizationRouteDependencies;
  employees?: EmployeeRouteDependencies;
  geocoding?: GeocodingRouteDependencies;
  frontendOrigin?: string;
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const frontendOrigin = options.frontendOrigin ?? process.env.FRONTEND_ORIGIN;

  if (frontendOrigin) {
    app.use((request: Request, response: Response, next: NextFunction) => {
      response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      if (request.method === "OPTIONS") return response.sendStatus(204);
      return next();
    });
  }

  app.use(express.json());

  app.get("/", (_request, response) => response.json({message: "Employee Routes API"}));
  app.get("/health", (_request, response) => response.json({status: "ok"}));
  app.use("/employees", createEmployeeRouter(options.employees));
  app.use("/api/geocoding", createGeocodingRouter(options.geocoding));
  app.use("/api/routes", createOptimizationRouter(options.optimization));

  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    if (error instanceof SyntaxError) {
      return response.status(400).json({error: {code: "INVALID_JSON", message: "O corpo da requisição contém JSON inválido."}});
    }
    console.error(error);
    return response.status(500).json({error: {code: "INTERNAL_ERROR", message: "Ocorreu um erro interno."}});
  });

  return app;
}

const app = createApp();

export default app;
