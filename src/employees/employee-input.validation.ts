export interface CoordinateInput {
  latitude?: unknown;
  longitude?: unknown;
}

export function validateOptionalCoordinates(input: CoordinateInput):
  | {valid: true; provided: boolean; latitude?: number; longitude?: number}
  | {valid: false; message: string} {
  const hasLatitude = input.latitude !== undefined;
  const hasLongitude = input.longitude !== undefined;

  if (hasLatitude !== hasLongitude) {
    return {valid: false, message: "Latitude e longitude devem ser informadas juntas."};
  }
  if (!hasLatitude) return {valid: true, provided: false};

  if (typeof input.latitude !== "number" || !Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    return {valid: false, message: "Latitude deve ser um número entre -90 e 90."};
  }
  if (typeof input.longitude !== "number" || !Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    return {valid: false, message: "Longitude deve ser um número entre -180 e 180."};
  }

  return {valid: true, provided: true, latitude: input.latitude, longitude: input.longitude};
}
