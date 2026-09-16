import type {
  RoutingMatrix,
  RoutingPoint,
  RoutingProvider,
} from "../routing.types.js";

interface LocationIQResponse {
  durations: (number | null)[][];
  distances: (number | null)[][];
}

export class LocationIQRoutingProvider implements RoutingProvider {
  async getMatrix(points: RoutingPoint[]): Promise<RoutingMatrix> {
    if (points.length < 2) {
      throw new Error("At least two routing points are required.");
    }

    const apiKey = process.env.LOCATIONIQ_API_KEY;

    if (!apiKey) {
      throw new Error("LOCATIONIQ_API_KEY is not configured.");
    }

    const coordinates = points
      .map((point) => `${point.longitude},${point.latitude}`)
      .join(";");

    const params = new URLSearchParams({
      key: apiKey,
      annotations: "distance,duration",
    });

    const url = `https://us1.locationiq.com/v1/matrix/driving/${coordinates}?${params}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Routing request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as LocationIQResponse;

    const metrics = data.durations.map((durationRow, rowIndex) =>
      durationRow.map((duration, columnIndex) => {
        const distance = data.distances[rowIndex]?.[columnIndex];

        if (duration === null || distance === null || distance === undefined) {
          throw new Error(
            `Route not found between points ${rowIndex} and ${columnIndex}.`,
          );
        }

        return {
          durationSeconds: duration,
          distanceMeters: distance,
        };
      }),
    );

    const matrix: RoutingMatrix = {
      points,
      metrics,
    };

    return matrix;
  }
}
