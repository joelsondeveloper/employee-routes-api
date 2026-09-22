export interface UnavailableRoute {
  fromId: string;
  toId: string;
}

/** Only confirmed lack of a route is recoverable by the optimization engine. */
export class RouteUnavailableError extends Error {
  constructor(public readonly relations: UnavailableRoute[]) {
    super(relations.length ? `Route unavailable: ${relations.map(r => `${r.fromId} -> ${r.toId}`).join(", ")}` : "No route available for the requested points.");
    this.name = "RouteUnavailableError";
  }
}

export class RoutingInputError extends Error {
  constructor(message: string) { super(message); this.name = "RoutingInputError"; }
}

export type RoutingProviderErrorKind = "CONFIGURATION" | "UPSTREAM";

/** A provider failure that is safe for the HTTP boundary to classify. */
export class RoutingProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: RoutingProviderErrorKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "RoutingProviderError";
  }
}

export class InvalidRoutingMatrixError extends Error {
  constructor(message: string) { super(message); this.name = "InvalidRoutingMatrixError"; }
}

/** The provider rejected a batch as too large for the requested point combination. */
export class RoutingMatrixTooLargeError extends Error {
  constructor(public readonly pointIds: string[]) {
    super(`Routing Matrix batch is too large for points: ${pointIds.join(", ")}`);
    this.name = "RoutingMatrixTooLargeError";
  }
}
