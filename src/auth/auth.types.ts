import type {Request} from "express";
import type {AuthContext, AuthRepository, GoogleIdentity} from "../database/repository.types.js";

export interface GoogleTokenVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

/** sessionToken, when present, replaces the short-lived Google token in the session cookie. */
export type SignInResult = AuthContext & {sessionToken?: string};

export interface AuthService {
  signIn(idToken: string): Promise<SignInResult>;
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

