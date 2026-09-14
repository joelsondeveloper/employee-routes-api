import {
  calculateDistance,
  calculateBearing
} from "./geography.utils.js";

const company = {
  latitude: -8.287,
  longitude: -35.035
};

const employee = {
  latitude: -8.300,
  longitude: -35.020
};

console.log(
  "Distance:",
  calculateDistance(company, employee)
);

console.log(
  "Bearing:",
  calculateBearing(company, employee)
);