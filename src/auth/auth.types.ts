import type {Request} from "express";
import type {AuthContext, AuthRepository, GoogleIdentity} from "../database/repository.types.js";

export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export interface AuthService {
  signIn(idToken: string): Promise<AuthContext>;
  authenticate(idToken: string): Promise<AuthContext>;
}

export interface AuthDependencies {
  verifier?: GoogleTokenVerifier;
  repository?: AuthRepository;
  service?: AuthService;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}

