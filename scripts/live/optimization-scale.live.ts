// Real-API scale check for P0-2: runs the optimizer on 40 and 100 synthetic,
// inland points around the company with the real LocationIQ provider.
// Spends roughly 6 + 36 Matrix requests. Usage: npm run test:live -- scale
import assert from "node:assert/strict";
import {company} from "../../src/company/company.config.js";
import {optimizeEmployeeRoutes} from "../../src/optimization/employee-route-optimization.service.js";
import {LocationIQRoutingProvider} from "../../src/routing/providers/locationiq-routing.provider.js";
import {inlandGrid} from "./inland-grid.js";

const origin = {id: "company", ...company.coordinates};
for (const count of [40, 100]) {
  const result = await optimizeEmployeeRoutes(origin, inlandGrid(count), new LocationIQRoutingProvider());
  const seconds = (result.diagnostics!.durationMs / 1000).toFixed(1);
  console.log(`${count} employees: ${result.diagnostics!.externalCalls} Matrix requests, ${seconds} s, ${result.groups.length} groups, ${result.issues.length} issues`);
  assert.ok(result.diagnostics!.durationMs < 60_000, "must finish in under 60 s");
}
