function safeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  return error.message
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/(?:key|token|authorization)=[^\s&]+/gi, "$1=[redacted]");
}

export function logExternalProviderFailure(
  event: "GEOCODING_FAILED" | "ROUTING_PROVIDER_FAILED",
  provider: string,
  error: unknown,
  status?: number,
): void {
  console.error(event, {
    provider,
    status: status ?? "NETWORK_OR_UNKNOWN",
    error: safeErrorMessage(error),
  });
}
