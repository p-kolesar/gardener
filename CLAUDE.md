# Project Template — agent guide

Azure Function App (Python) + React SPA + Blob Storage template with Claude AI capability.

## Key docs

- **[docs/architecture/overview.md](docs/architecture/overview.md)** — layers and how they connect
- **[docs/guides/deployment.md](docs/guides/deployment.md)** — deploy order and secrets
- **[docs/guides/local-development.md](docs/guides/local-development.md)** — running locally
- **[tests/README.md](tests/README.md)** — test setup

## Working agreements

- **Run tests:** `backend/.venv/Scripts/python.exe -m pytest` (config in [pytest.ini](pytest.ini)). Fully offline.
- **Storage:** blobs are raw bytes written via `storage/blobs.py`. Any schema is the caller's concern.
- The single frontend↔backend seam is [frontend/src/api.js](frontend/src/api.js).

## Response behavior

- **Read/query commands** (reports, summaries, status, "what's outstanding", etc.) — execute directly, no upfront acknowledgment or paraphrasing.
- **Write/mutate commands** (logging new info, creating or updating entries) — confirm interpretation before making changes.

## General working principles

### 1. Think Before Coding
State assumptions. Surface tradeoffs. If unclear, ask.

### 2. Simplicity First
Minimum code. No speculative features, no unused abstractions.

### 3. Surgical Changes
Touch only what the task requires. Don't clean up adjacent code.

### 4. Goal-Driven Execution
Define a verifiable success criterion before writing code.
