import {ConfigError, loadConfig} from "./config/config.js";
import {buildApp} from "./runtime/build-app.js";

// Long-running process entry (local development, or a container host).
async function start(): Promise<void> {
  const {config, warnings} = loadConfig(process.env);
  for (const warning of warnings) console.warn("CONFIG_WARNING", {warning});
  const app = await buildApp(config);
  const server = app.listen(config.port, () => console.log(`Server is running on http://localhost:${config.port}`));
  server.on("error", (error) => {
    console.error("SERVER_START_FAILED", {error: error instanceof Error ? error.message : "unknown"});
    process.exitCode = 1;
  });
}

start().catch((error: unknown) => {
  if (error instanceof ConfigError) console.error("STARTUP_CONFIGURATION_ERROR", {problems: error.problems});
  else console.error("STARTUP_ERROR", {error: error instanceof Error ? `${error.name}: ${error.message}` : "unknown"});
  process.exitCode = 1;
});
