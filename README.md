# Time Tracker App

Field supervisors can allocate crew hours and completed quantities to project pay item codes. The app is structured for a hosted Next.js deployment with server-side Procore API integration.

## Current Scope

- Select a job.
- Select an allocation date, defaulting to the current date.
- Add crew members saved locally per job for now.
- Enter hours and quantity completed against pay items.
- Keep Procore integration boundaries ready for OAuth and API calls.

## Getting Started

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create local environment values:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Run the app:

   ```powershell
   npm run dev
   ```

4. Open `http://localhost:3000`.

## Project Layout

- `src/app` - Next.js routes, page shell, and API route handlers.
- `src/components` - shared UI primitives.
- `src/features/time-allocation` - supervisor-facing time allocation workflow.
- `src/lib/procore` - Procore API client, types, and future OAuth helpers.
- `src/lib/data` - temporary mock data until Procore is connected.

## Procore Integration Path

1. Add OAuth login and callback routes under `src/app/api/procore/oauth`.
2. Store encrypted Procore access and refresh tokens server-side.
3. Replace mock jobs and pay items with project and budget code calls in `src/lib/procore`.
4. Persist crew members and daily allocations in an application database.

## Local Procore Values

Keep these in `.env.local`, never in committed source files:

```env
PROCORE_CLIENT_ID=your_client_id
PROCORE_CLIENT_SECRET=your_client_secret
PROCORE_TOKEN_ENCRYPTION_KEY=your_long_random_secret
PROCORE_COMPANY_ID=your_company_id
```

`PROCORE_TOKEN_ENCRYPTION_KEY` should be set in production. If it is omitted, the app falls back to `PROCORE_CLIENT_SECRET` for token encryption so existing deployments continue to work.
