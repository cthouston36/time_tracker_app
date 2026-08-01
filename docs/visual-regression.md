# Visual Regression Testing

The Playwright visual suite captures the main responsive app surfaces with mocked API responses, so it does not depend on Neon, NetSuite, or Procore data.

Covered screens:

- Dashboard
- Entry
- Expanded pay item matrix
- Daily report modal
- Reports
- Admin drawer
- Desktop, iPad Pro-sized, and iPhone/Safari-sized viewports

## First-Time Setup

Install Playwright browsers once on a machine:

```powershell
npx playwright install chromium webkit
```

Create or refresh screenshot baselines after an intentional UI change:

```powershell
npm run test:visual:update
```

Run regression checks:

```powershell
npm run test:visual
```

The npm scripts run through `scripts/run-visual-tests.mjs`. The wrapper starts the Next dev server on `http://127.0.0.1:3100`, waits for it to become ready, runs Playwright, and then stops the server.

The wrapper has bounded timeouts so a stuck visual run does not sit indefinitely:

- `VISUAL_SERVER_READY_TIMEOUT_MS`, default `60000`
- `VISUAL_TEST_TIMEOUT_MS`, default `240000`
