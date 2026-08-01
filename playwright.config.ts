import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02
    }
  },
  fullyParallel: false,
  projects: [
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        viewport: {
          height: 1000,
          width: 1440
        }
      }
    },
    {
      name: "ipad-pro-chromium",
      use: {
        browserName: "chromium",
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
        viewport: {
          height: 1366,
          width: 1024
        }
      }
    },
    {
      name: "mobile-safari-size",
      use: {
        ...devices["iPhone 14"],
        browserName: "webkit"
      }
    }
  ],
  reporter: [["list"], ["html", { open: "never" }]],
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/visual",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "on-first-retry"
  },
});
