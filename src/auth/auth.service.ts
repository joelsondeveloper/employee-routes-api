import type {AuthContext, AuthRepository} from "../database/repository.types.js";
import {GoogleAuthService} from "./google-auth.service.js";
import type {AuthService, GoogleTokenVerifier} from "./auth.types.js";

export class DefaultAuthService implements AuthService {
  constructor(
    private readonly verifier: GoogleTokenVerifier = new GoogleAuthService(),
    private readonly repository: AuthRepository,
  ) {}

  async signIn(idToken: string): Promise<AuthContext> {
    const identity = await this.verifier.verify(idToken);
    return this.repository.upsertGoogleIdentity(identity);
  }

  async authenticate(idToken: string): Promise<AuthContext> {
    const identity = await this.verifier.verify(idToken);
    const context = await this.repository.findByGoogleSubject(identity.subject);
    if (!context) throw new Error("Authenticated Google user has no local account.");
    return context;
  }
}

