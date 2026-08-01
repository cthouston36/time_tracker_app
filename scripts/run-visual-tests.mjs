import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const SERVER_URL = `http://${HOST}:${PORT}`;
const SERVER_READY_TIMEOUT_MS = Number(process.env.VISUAL_SERVER_READY_TIMEOUT_MS ?? 60_000);
const PLAYWRIGHT_TIMEOUT_MS = Number(process.env.VISUAL_TEST_TIMEOUT_MS ?? 240_000);
const POLL_INTERVAL_MS = 1_000;

let serverProcess = null;

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

const exitCode = await run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  return 1;
});

cleanup();
process.exit(exitCode);

async function run() {
  const serverAlreadyRunning = await isServerReady();

  if (!serverAlreadyRunning) {
    cleanNextBuildOutput();

    serverProcess = spawn(
      process.execPath,
      ["./node_modules/next/dist/bin/next", "dev", "--hostname", HOST, "--port", PORT],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true
      }
    );

    serverProcess.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    serverProcess.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });

    await waitForServer();
  }

  return runPlaywright();
}

function cleanNextBuildOutput() {
  const result = spawnSync(process.execPath, ["scripts/clean-next.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
    windowsHide: true
  });

  if (result.status !== 0) {
    throw new Error(`Unable to clean .next before visual tests. Exit code: ${result.status ?? "unknown"}.`);
  }
}

async function waitForServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SERVER_READY_TIMEOUT_MS) {
    if (serverProcess?.exitCode !== null) {
      throw new Error(`Visual test server exited before it was ready with code ${serverProcess.exitCode}.`);
    }

    if (await isServerReady()) {
      return;
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`Visual test server did not become ready at ${SERVER_URL} within ${SERVER_READY_TIMEOUT_MS}ms.`);
}

async function isServerReady() {
  try {
    const response = await fetch(SERVER_URL, {
      signal: AbortSignal.timeout(2_000)
    });

    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

function runPlaywright() {
  const args = ["./node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)];
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PLAYWRIGHT_EXTERNAL_SERVER: "1"
    },
    stdio: "inherit",
    windowsHide: true
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error(`Visual test run exceeded ${PLAYWRIGHT_TIMEOUT_MS}ms. Stopping Playwright.`);
      killProcessTree(child);
      resolve(1);
    }, PLAYWRIGHT_TIMEOUT_MS);

    child.on("exit", (code, signal) => {
      clearTimeout(timeout);

      if (signal) {
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

function cleanup() {
  if (serverProcess && serverProcess.exitCode === null) {
    killProcessTree(serverProcess);
  }
}

function killProcessTree(child) {
  if (!child?.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  child.kill("SIGTERM");
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
