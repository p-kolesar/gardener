# Local development

Status: **current** · Last verified: 2026-06-13

## Backend

1. Create a venv and install deps:
   ```bash
   cd backend
   python -m venv .venv
   .venv/Scripts/pip install -r requirements.txt
   ```
2. Copy `local.settings.json.example` → `local.settings.json` and fill in keys.
3. Set `AzureWebJobsStorage` to `UseDevelopmentStorage=true` (Azurite) or a real connection string.
4. `func start` — the health endpoint is at `GET http://localhost:7071/api/health`.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

To hit the backend during dev, set `VITE_API_BASE=http://localhost:7071/api` in `frontend/.env`.
