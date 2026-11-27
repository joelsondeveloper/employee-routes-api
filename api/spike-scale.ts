// THROWAWAY SPIKE for P0-2 (never merged): runs the new optimizer against the
// real LocationIQ API with 40 and 100 synthetic inland employees. Preview only,
// once per function instance (~42 Matrix requests). Never returns the key.
import type {IncomingMessage, ServerResponse} from "node:http";
import {company} from "../src/company/company.config.js";
import {optimizeEmployeeRoutes} from "../src/optimization/employee-route-optimization.service.js";
import {LocationIQRoutingProvider} from "../src/routing/providers/locationiq-routing.provider.js";
import {inlandGrid} from "../scripts/live/inland-grid.js";

let alreadyRan = false;

export default async function handler(_request: IncomingMessage, response: ServerResponse): Promise<void> {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  if (process.env.VERCEL_ENV !== "preview" || !process.env.LOCATIONIQ_API_KEY) { response.statusCode = 404; response.end("{}"); return; }
  if (alreadyRan) { response.statusCode = 409; response.end(JSON.stringify({error: "already ran on this instance"})); return; }
  alreadyRan = true;
  const origin = {id: "company", ...company.coordinates};
  const runs: unknown[] = [];
  for (const count of [40, 100]) {
    const started = Date.now();
    try {
      const result = await optimizeEmployeeRoutes(origin, inlandGrid(count), new LocationIQRoutingProvider(), undefined, undefined, {budgetMs: 240_000});
      runs.push({count, wallMs: Date.now() - started, ...result.diagnostics, groups: result.groups.length,
        accepted: result.summary.acceptableGroups, rejected: result.summary.rejectedGroups, issues: result.issues.length,
        unroutable: result.summary.unroutableEmployees, averageOccupancy: Number(result.summary.averageOccupancy.toFixed(2))});
    } catch (error) {
      runs.push({count, wallMs: Date.now() - started, error: error instanceof Error ? `${error.name}: ${error.message.replace(/key=[^&\s]+/g, "key=[redacted]")}` : "unknown"});
    }
  }
  response.end(JSON.stringify({runs}, null, 2));
}
