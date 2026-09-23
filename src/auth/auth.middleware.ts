import type {NextFunction, Request, RequestHandler, Response} from "express";
import type {AuthService} from "./auth.types.js";
import {AuthConfigurationError, InvalidGoogleTokenError} from "./google-auth.service.js";

export function createRequireAuth(service: AuthService): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    const header = request.header("authorization");
    const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    const cookieToken = request.header("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith("employee_routes_google_id="))?.slice("employee_routes_google_id=".length) ?? "";
    let token = bearer;
    if (!token && cookieToken) {
      try { token = decodeURIComponent(cookieToken); } catch { token = ""; }
    }
    if (!token) return response.status(401).json({error: {code: "UNAUTHENTICATED", message: "Faça login para continuar."}});
    try {
      request.auth = await service.authenticate(token);
      return next();
    } catch (error) {
      if (error instanceof AuthConfigurationError) return response.status(500).json({error: {code: "AUTH_CONFIGURATION", message: "A autenticação não está configurada."}});
      if (error instanceof InvalidGoogleTokenError || (error instanceof Error && error.message.includes("no local account"))) {
        return response.status(401).json({error: {code: "UNAUTHENTICATED", message: "Sua sessão expirou. Faça login novamente."}});
      }
      console.error("AUTHENTICATION_FAILED", {error: error instanceof Error ? error.name : "unknown"});
      return response.status(503).json({error: {code: "AUTHENTICATION_UNAVAILABLE", message: "Não foi possível validar sua sessão."}});
    }
  };
}

