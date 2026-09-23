import {Router, type Request, type Response} from "express";
import type {AuthService} from "./auth.types.js";
import {createRequireAuth} from "./auth.middleware.js";
import {AuthConfigurationError, InvalidGoogleTokenError} from "./google-auth.service.js";

export function createAuthRouter(service: AuthService): Router {
  const router = Router();
  router.post("/google", async (request: Request, response: Response) => {
    const credential = request.body?.credential;
    if (typeof credential !== "string" || !credential.trim()) {
      return response.status(400).json({error: {code: "INVALID_AUTH_REQUEST", message: "Informe a credencial do Google."}});
    }
    try {
      const context = await service.signIn(credential);
      const sameSite = process.env.NODE_ENV === "production" ? "SameSite=None; " : "SameSite=Lax; ";
      const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
      response.setHeader("Set-Cookie", `employee_routes_google_id=${encodeURIComponent(credential)}; Max-Age=3600; Path=/; HttpOnly; ${sameSite}${secure}`);
      return response.json({user: {id: context.userId, name: context.name, email: context.email, ...(context.avatarUrl ? {avatarUrl: context.avatarUrl} : {})}, organization: {id: context.organizationId, name: context.organizationName}, role: context.role});
    } catch (error) {
      if (error instanceof AuthConfigurationError) return response.status(500).json({error: {code: "AUTH_CONFIGURATION", message: "A autenticação não está configurada."}});
      if (error instanceof InvalidGoogleTokenError) return response.status(401).json({error: {code: "INVALID_GOOGLE_TOKEN", message: "Não foi possível validar o login do Google."}});
      console.error("GOOGLE_AUTH_FAILED", {error: error instanceof Error ? error.name : "unknown"});
      return response.status(503).json({error: {code: "AUTHENTICATION_UNAVAILABLE", message: "Não foi possível concluir o login agora."}});
    }
  });
  router.get("/me", createRequireAuth(service), (request: Request, response: Response) => {
    const context = request.auth;
    if (!context) return response.status(401).json({error: {code: "UNAUTHENTICATED", message: "Faça login para continuar."}});
    return response.json({user: {id: context.userId, name: context.name, email: context.email, ...(context.avatarUrl ? {avatarUrl: context.avatarUrl} : {})}, organization: {id: context.organizationId, name: context.organizationName}, role: context.role});
  });
  router.post("/logout", (_request: Request, response: Response) => {
    const sameSite = process.env.NODE_ENV === "production" ? "SameSite=None; " : "SameSite=Lax; ";
    const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
    return response.setHeader("Set-Cookie", `employee_routes_google_id=; Max-Age=0; Path=/; HttpOnly; ${sameSite}${secure}`).sendStatus(204);
  });
  return router;
}

