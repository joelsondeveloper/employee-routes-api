import {
  GeocodingNotFoundError,
  GeocodingProviderError,
} from "./geocoding.errors.js";

interface GeocodingResult {
  latitude: number;
  longitude: number;
}

interface LocationIQResult {
  lat: number;
  lon: number;
}

const GEOCODING_TIMEOUT_MS = 10_000;
const GEOCODING_ATTEMPTS = 2;
const GEOCODING_RETRY_DELAY_MS = 750;

/** One retry for throttling, server or network failures; an operator is waiting on the form. */
async function fetchGeocoding(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    let response: Response | undefined;
    let failure: unknown;
    try {
      response = await fetch(url, {signal: AbortSignal.timeout(GEOCODING_TIMEOUT_MS)});
    } catch (error) {
      failure = error;
    }
    const retryable = failure !== undefined || response!.status === 429 || response!.status >= 500;
    if (!retryable || attempt >= GEOCODING_ATTEMPTS) {
      if (failure !== undefined) {
        throw new GeocodingProviderError(failure instanceof Error ? failure.message : "Geocoding request failed.");
      }
      return response!;
    }
    await response?.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, GEOCODING_RETRY_DELAY_MS * attempt));
  }
}

export async function geocodeAddress(
  address: string,
): Promise<GeocodingResult> {
  const apiKey = process.env.LOCATIONIQ_API_KEY;

  if (!apiKey) {
    throw new GeocodingProviderError("LOCATIONIQ_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    key: apiKey,
    q: address,
    format: "json",
  });

  const response = await fetchGeocoding(`https://us1.locationiq.com/v1/search.php?${params}`);

  if (response.status === 404) {
    throw new GeocodingNotFoundError();
  }

  if (!response.ok) {
    throw new GeocodingProviderError(
      `Geocoding request failed with status ${response.status}`,
      response.status,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new GeocodingProviderError(
      error instanceof Error ? error.message : "Invalid geocoding response.",
      response.status,
    );
  }

  if (!Array.isArray(data) || !data.length) {
    throw new GeocodingNotFoundError();
  }

  const result = data[0];
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new GeocodingProviderError("Geocoding provider returned invalid coordinates");
  }

  return {
    latitude,
    longitude,
  };
}
