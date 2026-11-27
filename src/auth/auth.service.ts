import type {AuthContext, AuthRepository} from "../database/repository.types.js";
import {GoogleAuthService, InvalidGoogleTokenError} from "./google-auth.service.js";
import type {AuthService, GoogleTokenVerifier, SignInResult} from "./auth.types.js";
import {createSessionToken, isSessionToken, verifySessionToken} from "./session-token.js";

export class DefaultAuthService implements AuthService {
  constructor(
    private readonly verifier: GoogleTokenVerifier = new GoogleAuthService(),
    private readonly repository: AuthRepository,
    private readonly sessionSecret: string | undefined = process.env.SESSION_SECRET,
  ) {}

  async signIn(idToken: string): Promise<SignInResult> {
    const identity = await this.verifier.verify(idToken);
    const context = await this.repository.upsertGoogleIdentity(identity);
    return this.sessionSecret ? {...context, sessionToken: createSessionToken(identity.subject, this.sessionSecret)} : context;
  }

  async authenticate(token: string): Promise<AuthContext> {
    let subject: string;
    if (isSessionToken(token)) {
      const verified = this.sessionSecret ? verifySessionToken(token, this.sessionSecret) : undefined;
      if (!verified) throw new InvalidGoogleTokenError();
      subject = verified;
    } else {
      subject = (await this.verifier.verify(token)).subject;
    }
    const context = await this.repository.findByGoogleSubject(subject);
    if (!context) throw new Error("Authenticated Google user has no local account.");
    return context;
  }
}
