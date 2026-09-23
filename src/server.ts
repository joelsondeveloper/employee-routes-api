import {createApp} from "./app.js";
import {DefaultAuthService} from "./auth/auth.service.js";
import {GoogleAuthService} from "./auth/google-auth.service.js";
import {initializePostgresRuntime} from "./database/runtime.js";

const nodeEnv = process.env.NODE_ENV ?? "development";
const required = ["LOCATIONIQ_API_KEY", "DATABASE_URL", "GOOGLE_CLIENT_ID", "FRONTEND_ORIGIN"] as const;
if (nodeEnv === "production") {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error("STARTUP_CONFIGURATION_ERROR", {missing});
    process.exit(1);
  }
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port <= 0) {
  console.error("STARTUP_CONFIGURATION_ERROR", {invalid: "PORT"});
  process.exit(1);
}

async function start(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    if (nodeEnv === "production") throw new Error("DATABASE_URL is required in production.");
    const {default: app} = await import("./app.js");
    app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));
    return;
  }
  const runtime = await initializePostgresRuntime();
  const app = createApp({
    requireAuthentication: true,
    auth: {service: new DefaultAuthService(new GoogleAuthService(), runtime.authRepository)},
    employees: {employeeRepository: runtime.employeeRepository},
    optimization: {employeeRepository: runtime.employeeRepository},
  });
  const server = app.listen(port, () => console.log(`Server is running on port ${port}`));
  server.on("error", (error) => {
    console.error("SERVER_START_FAILED", {error: error instanceof Error ? error.message : "unknown"});
    process.exitCode = 1;
  });
}

start().catch((error) => {
  console.error("STARTUP_DATABASE_ERROR", {error: error instanceof Error ? error.message : "unknown"});
  process.exitCode = 1;
});

