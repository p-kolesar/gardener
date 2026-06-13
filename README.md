# Gardener — Voice Field Log

Mobile-first voice logging app for a gardener to record work hours, material costs, and to-dos across client projects. Speak a note → Claude parses intent → confirm → saved.

## Architecture

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + Vite → Azure Static Web App | `frontend/` |
| Backend | Python Azure Functions (Flex Consumption) | `backend/` |
| Storage | Azure Blob Storage | raw bytes; helpers in `backend/storage/blobs.py` |
| AI | Anthropic Claude (`claude-sonnet-4-6`) | voice parse + status/summary queries |
| Transcription | OpenAI Whisper (`whisper-1`) | SK and EN supported |
| Infra | Bicep | `infra/` |

---

## Data model

### Project
```json
{
  "id": "uuid",
  "name": "string",
  "status": "active | archived",
  "created_at": "iso8601",
  "archived_at": "iso8601 | null"
}
```
- Projects are **n:1 with clients** — one client may have multiple projects over time.
- Archive naming convention: `{name}_{YYYYMMDD}` (closure date), e.g. `Kováč_20260613`.
- The **Unassigned** project is seeded automatically on the first `GET /projects` call.

### Entry (work log or material cost)
```json
{
  "id": "uuid",
  "type": "log_work | log_material | add_todo | complete_todo",
  "project_name": "string",
  "hours": "number | null",
  "euros": "number | null",
  "description": "string | null",
  "date": "YYYY-MM-DD",
  "completes_todo_id": "uuid | null",
  "audio_id": "uuid | null",
  "raw_transcript": "string",
  "user_id": "string | null",
  "org_id": "string | null",
  "created_at": "iso8601"
}
```
- `hours` populated for `log_work`; `euros` for `log_material`.
- Entries reference projects by `project_name` (not `project_id`).
- `user_id` / `org_id` stamped at write time from `X-User-Id` / `X-Org-Id` headers (null until auth is wired).

### Todo
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "description": "string",
  "status": "open | done",
  "completed_by_entry_id": "uuid | null",
  "completed_at": "iso8601 | null",
  "created_at": "iso8601"
}
```

### Blob storage layout
```
audio/{uuid}.webm          raw audio clip per recording
data/entries.json          Entry[]   — all entries
data/todos.json            Todo[]    — all to-dos
data/projects.json         Project[] — all projects
```

---

## Voice pipeline

```
Mic → MediaRecorder → POST /transcribe (Whisper) → transcript + audio_id
                                                         ↓
                                         POST /voice/process (Claude)
                                                         ↓
                            { confidence, clarification_question, commands[] }
                                                         ↓
                                              ConfirmCard (UI)
                            green (high) → auto-save after 4 s
                            amber (low)  → clarify via voice or confirm/discard
                                                         ↓
                              POST /entries  ·  POST /todos  ·  POST /projects
                              PATCH /todos/{id}  ·  PATCH /projects/{id}
                              POST /projects/{id}/query  (get_status / get_summary)
```

### Command types Claude returns

| type | triggers | fields |
|---|---|---|
| `log_work` | default when hours mentioned | `project_name`, `hours`, `description?`, `date` |
| `log_material` | default when euros/currency mentioned | `project_name`, `euros`, `description?`, `date` |
| `add_todo` | "need to", "should", "buy", "acquire", "order" | `project_name`, `description`, `date` |
| `complete_todo` | "finished", "completed", "done", "wrapped up" only | `project_name`, `description`, `date`, `completes_todo_id?` |
| `create_project` | "new project ABC" | `project_name` |
| `archive_project` | "archive project ABC" | `project_name` |
| `get_status` | "project ABC status / remaining / what's left" | `project_name` |
| `get_summary` | "project ABC summary / what did we do" | `project_name` |

**Completion rule:** only explicit completion words trigger `complete_todo`. "I worked on", "I was doing", "I started" — never completion.

**Query routing:** `get_summary` → Claude summarises completed work (entries); `get_status` → Claude summarises open to-dos.

---

## Backend API

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | liveness check |
| POST | `/transcribe?lang=sk` | Whisper transcription; saves audio blob; returns `{ transcript, audio_id }` |
| POST | `/voice/process` | Claude intent parse; accepts optional `history[]` (last 3 turns) for conversation mode; returns `{ confidence, clarification_question, commands[] }` |
| GET | `/projects` | List all projects; seeds Unassigned on first call |
| POST | `/projects` | Create project; body `{ name }` |
| PATCH | `/projects/{id}` | Archive (body `{ status: "archived" }` renames to `{name}_{YYYYMMDD}`) or general field update |
| POST | `/projects/{id}/query` | AI summary; body `{ type: "summary" \| "status" }`; returns `{ response }` |
| GET | `/todos?project_id=&status=` | List to-dos; both params optional |
| POST | `/todos` | Create to-do; body `{ project_id, description }` |
| PATCH | `/todos/{id}` | Update to-do; supports `status`, `completed_by_entry_id`, `completed_at` |
| GET | `/entries?project_id=&type=` | List entries; both params optional |
| POST | `/entries` | Save entry batch; stamps `id` (uuid) on each; returns `{ saved, ids[] }` |

---

## Frontend

- **Project selector** — populated from `GET /projects`; last selection persisted to `localStorage`
- **Mic button** — tap to record, tap to stop; pulsing ring animation while recording
- **Auto-pipeline** — after recording stops: transcribe → parse → show card, no extra taps
- **ConfirmCard** — slides up from bottom
  - Green (high confidence): 4 s countdown bar, auto-saves, tap to save early
  - Amber (low confidence): shows clarification question; Save as-is / 🎙 Clarify / Discard
  - Query result view: shows AI response text for `get_status` / `get_summary` commands
- **Project accordion** — one collapsible row per active project below the mic
  - Header: name · total hours · total € · open to-do count; Unassigned appears last
  - Expanded — **Work log**: last 30 entries sorted by date (date · icon · amount · description)
  - Expanded — **To-dos**: open items with checkbox → inline hours input → creates entry + closes todo; toggle to reveal done items
- **Voice project commands** — `create_project` and `archive_project` wired to API; `get_status` / `get_summary` call `/projects/{id}/query` and display response in ConfirmCard
- **TTS toggle** (🔇 off by default) — speaks parsed summary or clarification question via browser `SpeechSynthesis`
- **Conversation mode toggle** (💬) — after TTS finishes speaking, auto-restarts the mic; last 3 turns passed as `history[]` to `/voice/process`
- **SK / EN language toggle** — affects Whisper and TTS locale

---

## Business rules

1. **Default → log.** No instruction keyword = `log_work` or `log_material`.
2. **Hours vs euros.** Number + `h/hr/hour` or no unit in work context → hours. Number + `€/euro/EUR` or material context → euros.
3. **Completion gating.** Only `finished / completed / done / all done / wrapped up` → completion. Never `worked on / started / was doing`.
4. **Project default.** Selected project in the UI is the default; only overridden if another project is clearly named in speech.
5. **Unassigned.** No project identified in speech → `Unassigned` project. Cannot be archived.
6. **Archive naming.** `{project_name}_{YYYYMMDD}` where date = day the archive command is spoken.
7. **Manual to-do close.** Tapping checkbox in UI → inline hours prompt → creates `log_work` entry linked to to-do (`completed_by_entry_id`) → closes to-do.

---

## Future phases

### Auth / multi-user
- `user_id` and `org_id` already stamped on every entry at write time (null until auth wired).
- Recommended path: Azure Static Web Apps built-in auth sets `X-MS-CLIENT-PRINCIPAL` → backend extracts and maps to `X-User-Id` / `X-Org-Id`.

### Reporting / export
- Per-project invoice summary (hours × rate + materials).
- CSV / PDF export of entries for a date range.

---

## Deployment pipelines

| Workflow | Trigger | What it does |
|---|---|---|
| `infra.yml` | push to `infra/**` or manual | Provisions Azure resources via Bicep |
| `deploy.yml` | push to `backend/**` or manual | Deploys Function App; smoke-tests `/api/health` |
| `deploy-frontend.yml` | push to `frontend/**` or manual | Builds React SPA; deploys to Static Web App |

## Secrets required

| Secret | Where |
|---|---|
| `AZURE_CREDENTIALS` | GitHub → Settings → Secrets |
| `CLAUDE_API_KEY` (or `ANTHROPIC_API_KEY`) | Azure Function App settings |
| `OPENAI_API_KEY` | Azure Function App settings |

## Deploy order

1. Set secrets and variables
2. Run **Infra** workflow
3. Run **Deploy** workflow (backend)
4. Run **Deploy Frontend** workflow (frontend)

## Local development

See [docs/guides/local-development.md](docs/guides/local-development.md).

## Tests

```
backend/.venv/Scripts/python.exe -m pytest
```
