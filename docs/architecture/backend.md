# Backend

Status: **stub** · Last verified: 2026-06-13

Python v2 Azure Function App (Flex Consumption). Source: [`backend/`](../../backend/).

## Endpoints

| Route | Method | Description |
| --- | --- | --- |
| `/api/health` | GET | Liveness probe — returns `{"status": "ok"}` |

## Storage

Blobs are read/written via `storage/blobs.py` (`upload` / `download`). The data container is `data`.

## Claude integration

`anthropic` is installed. Set `CLAUDE_API_KEY` in app settings (provisioned by Bicep). Wire up calls as needed.
