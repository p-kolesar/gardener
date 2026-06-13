# Deployment

Status: **current** · Last verified: 2026-06-13

See the root [README.md](../../README.md) for the full deploy order, secrets, and variables.

## First-time order

1. **Infra** (`infra.yml`) — creates the resource group, Function App, Static Web App. Reads hostnames from the run summary.
2. **Deploy backend** (`deploy.yml`) — deploys `backend/`, smoke-tests `/api/health`.
3. **Deploy frontend** (`deploy-frontend.yml`) — builds with `VITE_API_BASE` pointing at the live API.

After the first run, pushes to `main` trigger each pipeline by changed path.

## Common failure modes

| Symptom | Cause / fix |
| --- | --- |
| API calls fail with CORS errors | The SWA origin isn't in the Function App's `cors.allowedOrigins`. Bicep sets it automatically; re-run infra if the SWA was recreated. |
| First request is slow | Flex Consumption cold start — expected. |
