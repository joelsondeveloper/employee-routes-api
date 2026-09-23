import {OAuth2Client} from "google-auth-library";
import type {GoogleIdentity} from "../database/repository.types.js";
import type {GoogleTokenVerifier} from "./auth.types.js";

export class AuthConfigurationError extends Error {
  constructor() {
    super("GOOGLE_CLIENT_ID is required for Google authentication.");
    this.name = "AuthConfigurationError";
  }
}

export class InvalidGoogleTokenError extends Error {
  constructor() {
    super("The Google identity token is invalid.");
    this.name = "InvalidGoogleTokenError";
  }
}

export class GoogleAuthService implements GoogleTokenVerifier {
  private readonly client: OAuth2Client;
  private readonly audience: string;

  constructor(audience = process.env.GOOGLE_CLIENT_ID) {
    if (!audience) throw new AuthConfigurationError();
    this.audience = audience;
    this.client = new OAuth2Client();
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    try {
      const ticket = await this.client.verifyIdToken({idToken, audience: this.audience});
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || payload.email_verified === false) throw new InvalidGoogleTokenError();
      return {
        subject: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        ...(payload.picture ? {avatarUrl: payload.picture} : {}),
      };
    } catch (error) {
      if (error instanceof InvalidGoogleTokenError) throw error;
      throw new InvalidGoogleTokenError();
    }
  }
}

