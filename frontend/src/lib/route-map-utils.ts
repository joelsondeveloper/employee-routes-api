import type {RouteStop} from "../types/api";

export interface MapPassenger {
  stop: RouteStop;
  order: number;
  groupNumber: number;
}

export interface PassengerLocationCluster {
  latitude: number;
  longitude: number;
  passengers: MapPassenger[];
}

/**
 * Leaflet draws markers with identical coordinates on top of one another.
 * Keep every passenger, but group only the visual marker so the UI can expose
 * all stops that occupy the same point without changing route data.
 */
export function groupPassengersByLocation(passengers: MapPassenger[]): PassengerLocationCluster[] {
  const clusters = new Map<string, PassengerLocationCluster>();

  for (const passenger of passengers) {
    const {latitude, longitude} = passenger.stop;
    const key = `${latitude},${longitude}`;
    const existing = clusters.get(key);

    if (existing) {
      existing.passengers.push(passenger);
      continue;
    }

    clusters.set(key, {
      latitude,
      longitude,
      passengers: [passenger],
    });
  }

  return [...clusters.values()];
}
