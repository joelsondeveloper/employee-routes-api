// Manual checks against the real LocationIQ API (and, for final-optimization,
// a local SQLite database). They spend API quota, so they never run in `npm test`.
// Usage: npm run test:live            (all scripts)
//        npm run test:live -- routing  (scripts whose name contains "routing")
import {spawnSync} from "node:child_process";
import {readdirSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const filter = process.argv[2] ?? "";
const scripts = readdirSync(directory).filter((name) => name.endsWith(".live.ts") && name.includes(filter)).sort();
let failed = 0;
for (const script of scripts) {
  console.log(`\n=== ${script}`);
  const result = spawnSync("npx", ["tsx", "--env-file-if-exists=.env", join(directory, script)], {stdio: "inherit"});
  if (result.status !== 0) failed++;
}
console.log(`\n${scripts.length - failed}/${scripts.length} live scripts passed.`);
process.exitCode = failed ? 1 : 0;
