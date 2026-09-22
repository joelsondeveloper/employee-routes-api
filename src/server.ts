import app from "./app.js";

const nodeEnv = process.env.NODE_ENV ?? "development";
if (nodeEnv === "production" && !process.env.LOCATIONIQ_API_KEY) {
    console.error("STARTUP_CONFIGURATION_ERROR", {missing: "LOCATIONIQ_API_KEY"});
    process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port <= 0) {
    console.error("STARTUP_CONFIGURATION_ERROR", {invalid: "PORT"});
    process.exit(1);
}

const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

server.on("error", (error) => {
    console.error("SERVER_START_FAILED", {error: error instanceof Error ? error.message : "unknown error"});
    process.exitCode = 1;
});
