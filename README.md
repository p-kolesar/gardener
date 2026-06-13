# Project Template

Azure Function App (Python) + React SPA + Blob Storage, with Claude AI capability wired in.

## Architecture

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + Vite → Azure Static Web App | `frontend/` |
| Backend | Python Azure Functions (Flex Consumption) | `backend/` |
| Storage | Azure Blob Storage | raw bytes; helpers in `backend/storage/blobs.py` |
| AI | Anthropic Claude (SDK in requirements) | `CLAUDE_API_KEY` app setting |
| Infra | Bicep | `infra/` |

## Deployment pipelines (3)

| Workflow | Trigger | What it does |
|---|---|---|
| `infra.yml` | push to `infra/**` or manual | Provisions Azure resources via Bicep |
| `deploy.yml` | push to `backend/**` or manual | Deploys Function App; smoke-tests `/api/health` |
| `deploy-frontend.yml` | push to `frontend/**` or manual | Builds React SPA; deploys to Static Web App |

## Secrets required

| Secret | Where |
|---|---|
| `AZURE_CREDENTIALS` | GitHub → Settings → Secrets |
| `CLAUDE_API_KEY` | GitHub → Settings → Secrets |

## Variables required

| Variable | Example |
|---|---|
| `AZURE_RESOURCE_GROUP` | `rg-myapp-dev` |
| `AZURE_LOCATION` | `westeurope` |
| `AZURE_BASE_NAME` | `myapp` |

## Deploy order

1. Set secrets and variables above
2. Run **Infra** workflow (provisions everything)
3. Run **Deploy** workflow (backend)
4. Run **Deploy Frontend** workflow (frontend)

## Local development

See [docs/guides/local-development.md](docs/guides/local-development.md).

## Tests

```
backend/.venv/Scripts/python.exe -m pytest
```
