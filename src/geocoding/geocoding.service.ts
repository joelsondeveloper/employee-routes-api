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

  let response: Response;
  try {
    response = await fetch(
      `https://us1.locationiq.com/v1/search.php?${params}`,
    );
  } catch (error) {
    throw new GeocodingProviderError(
      error instanceof Error ? error.message : "Geocoding request failed.",
    );
  }

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
