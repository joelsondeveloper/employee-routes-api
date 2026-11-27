import type {Employee} from "../../src/employees/employee.types.js";

/** Deterministic synthetic employees on land around the company, for real-API checks. */
export function inlandGrid(count: number): Employee[] {
  // 10x10 grid west/south-west of the company (Jaboatão, Moreno, Cabo), avoiding the sea.
  const all: Employee[] = [];
  for (let row = 0; row < 10; row++) for (let column = 0; column < 10; column++) {
    all.push({id: `g${row}-${column}`, name: `G${row}${column}`, address: "", phone: "",
      latitude: -8.08 - row * 0.024, longitude: -34.96 - column * 0.014});
  }
  // Spread a smaller sample over the whole grid instead of taking the first rows.
  const step = all.length / count;
  return Array.from({length: count}, (_, index) => all[Math.floor(index * step)]!);
}
