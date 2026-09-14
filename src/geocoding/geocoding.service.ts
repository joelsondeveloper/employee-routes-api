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

  const response = await fetch(
    `https://us1.locationiq.com/v1/search.php?${params}`,
  );

  if (response.status === 404) {
    throw new GeocodingNotFoundError();
  }

  if (!response.ok) {
    throw new GeocodingProviderError(
      `Geocoding request failed with status ${response.status}`,
    );
  }

  if (!response.ok) {
    throw new GeocodingProviderError(
      "Geocoding request failed with status ${response.status}",
    );
  }

  const data = await response.json();

  if (!data.length) {
    throw new GeocodingNotFoundError();
  }

  const result = data[0];

  return {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  };
}
