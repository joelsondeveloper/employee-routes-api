import {describe, expect, it} from "vitest";
import {groupPassengersByLocation} from "./route-map-utils";

const stop = (id: string, latitude: number, longitude: number) => ({
  type: "EMPLOYEE" as const,
  id,
  employeeId: id,
  name: id,
  latitude,
  longitude,
});

describe("groupPassengersByLocation", () => {
  it("keeps all passengers in one visual cluster when coordinates are identical", () => {
    const clusters = groupPassengersByLocation([
      {stop: stop("demo-11", -8.1, -34.9), order: 1, groupNumber: 1},
      {stop: stop("demo-12", -8.1, -34.9), order: 2, groupNumber: 1},
      {stop: stop("demo-13", -8.2, -34.8), order: 3, groupNumber: 1},
    ]);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].passengers.map(({stop: item}) => item.id)).toEqual(["demo-11", "demo-12"]);
    expect(clusters[1].passengers.map(({stop: item}) => item.id)).toEqual(["demo-13"]);
  });

  it("does not merge different coordinates or directions", () => {
    const clusters = groupPassengersByLocation([
      {stop: stop("a", -8.1, -34.9), order: 1, groupNumber: 1},
      {stop: stop("b", -8.1, -34.900001), order: 2, groupNumber: 1},
      {stop: stop("c", -8.1, -34.9), order: 1, groupNumber: 2},
    ]);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].passengers.map(({stop: item}) => item.id)).toEqual(["a", "c"]);
    expect(clusters[1].passengers.map(({stop: item}) => item.id)).toEqual(["b"]);
  });
});
