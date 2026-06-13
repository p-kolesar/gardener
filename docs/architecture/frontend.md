# Frontend

Status: **stub** · Last verified: 2026-06-13

React + Vite SPA deployed to Azure Static Web Apps (Free). Source: [`frontend/`](../../frontend/).

## Key files

- `src/App.jsx` — root component (currently Hello World + health check display)
- `src/api.js` — single seam to the backend; all fetch calls go here
- `src/theme.css` — global styles

## Environment

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE` | Backend URL (e.g. `https://<func>.azurewebsites.net/api`). Unset → hits relative `/api` path. |
