import type {Request} from "express";

/**
 * Tenant used only when an app is built without authentication (unit tests and
 * local development). Production always mounts the auth middleware, so every
 * private request carries the organization resolved from its session.
 */
export const LOCAL_TENANT_ID = "local";

export function tenantId(request: Request): string {
  return request.auth?.organizationId ?? LOCAL_TENANT_ID;
}
