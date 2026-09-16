import { LocationIQRoutingProvider }
  from "./providers/locationiq-routing.provider.js";

import { findFastedRoute } from "./router-optimizer.service.js";

const provider = new LocationIQRoutingProvider();

const matrix = await provider.getMatrix([
  {
    id: "company",
    latitude: -8.3058014,
    longitude: -35.0223791,
  },
  {
    id: "employee-a",
    latitude: -8.2985031,
    longitude: -35.0365290,
  },
  {
    id: "employee-b",
    latitude: -8.285917,
    longitude: -35.0374083,
  },
  {
    id: "employee-c",
    latitude: -8.288198,
    longitude: -35.034804,
  },
  {
    id: "employee-d",
    latitude: -8.3309844,
    longitude: -34.9507633,
  },
]);

console.log("Matrix:");

console.dir(matrix, {
  depth: null,
});

const fastestRoute = findFastedRoute(
  matrix,
  0,
  [1, 2, 3, 4],
);

console.log("\nFastest route:");

console.dir(fastestRoute, {
  depth: null,
});