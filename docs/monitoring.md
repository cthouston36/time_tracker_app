# Monitoring And Alerts

## Health Check

Use this endpoint for uptime monitoring:

```txt
https://staging.chinchordaily.com/api/health
```

Expected healthy response:

```json
{
  "ok": true,
  "service": "time-tracker-app",
  "status": "ok"
}
```

Alert if the endpoint returns a non-2xx response or does not respond within 10 seconds.

## Recommended Staging Alerts

Set these up before adding more test users:

- Uptime check: `/api/health` every 5 minutes.
- Vercel function errors: alert on 5xx anomalies.
- Vercel function timeouts: alert on any repeated timeout trend.
- Neon usage: review compute, storage, and network transfer weekly while in staging.
- Procore sync: review the in-app Sync Log after large syncs.

## Recommended Production Alerts

Before launch, add:

- Uptime check: `/api/health` every 1 to 5 minutes.
- Vercel 5xx error alert.
- Vercel usage anomaly alert for function duration and edge requests.
- Neon storage and compute usage review.
- Manual weekly check of failed Procore sync and failed daily upload events.

## Notes

Vercel native alert rules require Observability Plus on Pro or Enterprise plans. Until then, use an external uptime monitor such as Better Stack, UptimeRobot, or another existing company monitoring tool against `/api/health`.
