# Architecture overview

Status: **current** · Last verified: 2026-06-13

## Components

| Component | Tech | Notes |
| --- | --- | --- |
| Backend API | Python Flex Consumption Function App | `backend/` |
| AI | Anthropic Claude SDK | `CLAUDE_API_KEY` app setting |
| Storage | Azure Blob Storage (raw bytes) | helpers in `backend/storage/blobs.py` |
| Frontend | React + Vite SPA → Azure Static Web Apps | `frontend/` |
| IaC / CI | Bicep + GitHub Actions (3 pipelines) | `infra/`, `.github/workflows/` |

## Request flow

```
Browser → React SPA → GET /api/health → Function App → 200 OK
```

## Blob storage

The Function App reads/writes blobs via `storage.blobs.upload` / `storage.blobs.download`.
The data container is named `data`. Format and schema are up to the application.
