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
  "is_default": false,
  "created_at": "iso8601"
}
```
- Projects are **n:1 with clients** — one client may have multiple projects over time.
- Archive naming convention: `{client_name}_{YYYYMMDD}` (closure date), e.g. `Kováč — Záhrada Marianka_20260613`.
- The **Unassigned** project (`is_default: true`) is a system project; cannot be archived.

### Entry (work log or material cost)
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "type": "work | material",
  "amount": 3.5,
  "description": "string | null",
  "entry_date": "YYYY-MM-DD",
  "completed_todo_id": "uuid | null",
  "audio_id": "uuid | null",
  "raw_transcript": "string",
  "user_id": "string | null",
  "org_id": "string | null",
  "created_at": "iso8601"
}
```
- `amount` = hours for work, euros for material.
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
  "audio_id": "uuid | null",
  "raw_transcript": "string",
  "user_id": "string | null",
  "org_id": "string | null",
  "created_at": "iso8601"
}
```

### Blob storage layout
```
audio/{uuid}.webm          raw audio clip per recording
data/entries.json          Entry[]  — all entries
data/todos.json            Todo[]   — all to-dos
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
                                              POST /entries (or /todos)
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
| `get_status` | "project ABC status / list / items" | `project_name` |
| `get_summary` | "project ABC summary" | `project_name` |

**Completion rule:** only explicit completion words trigger `complete_todo`. "I worked on", "I was doing", "I started" — never completion.

---

## Backend API

### Built
| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | liveness check |
| POST | `/transcribe?lang=sk` | Whisper transcription; saves audio blob; returns `{ transcript, audio_id }` |
| POST | `/voice/process` | Claude intent parse; returns `{ confidence, clarification_question, commands[] }` |
| POST | `/entries` | Save entry batch to `data/entries.json`; stamps `user_id`/`org_id` |

### Not yet built
| Method | Route | Purpose |
|---|---|---|
| GET | `/projects` | List active projects (seed Unassigned if missing) |
| POST | `/projects` | Create project |
| PATCH | `/projects/{id}` | Archive (renames to `{client}_{YYYYMMDD}`) |
| GET | `/entries?project_id=&type=&date_from=&date_to=` | Read entries |
| GET | `/todos?project_id=&status=` | Read to-dos |
| POST | `/todos` | Save to-do |
| PATCH | `/todos/{id}` | Complete to-do (link entry, set status done) |
| POST | `/projects/{id}/query` | AI status or summary; returns `{ response: string }` |

---

## Frontend

### Built
- **Project selector** — `<select>` (native OS picker on mobile), hardcoded for now
- **Mic button** — tap to record, tap to stop; pulsing ring animation while recording
- **Auto-pipeline** — after recording stops: transcribe → parse → show card, no extra taps
- **ConfirmCard** — slides up from bottom
  - Green (high confidence): 4 s countdown bar, auto-saves, tap to save early
  - Amber (low confidence): shows clarification question, three actions: Save as-is / 🎙 Clarify (re-records follow-up, reruns parse with context) / Discard
- **TTS toggle** (🔇 off by default, experimental) — speaks parsed summary or clarification question via browser `SpeechSynthesis`
- **SK / EN language toggle** — affects Whisper and TTS locale

### Not yet built
- Load projects from `GET /projects` (currently hardcoded)
- Project accordion list below the mic (total hours, total €, open to-do count per row)
- Entries list per project (date, type icon, amount, description)
- To-do list per project (open items; checkbox → hours prompt → close)
- Status / summary response in ConfirmCard (`get_status`, `get_summary` parsed but not actioned)
- Voice commands for `create_project` / `archive_project` wired to API
- TTS conversation loop mode (auto-restart mic after response is spoken)

---

## Business rules

1. **Default → log.** No instruction keyword = `log_work` or `log_material`.
2. **Hours vs euros.** Number + `h/hr/hour` or no unit in work context → hours. Number + `€/euro/EUR` or material context → euros.
3. **Completion gating.** Only `finished / completed / done / all done / wrapped up` → completion. Never `worked on / started / was doing`.
4. **Project default.** Selected project in the UI is the default; only overridden if another project is clearly named in speech.
5. **Unassigned.** No project identified in speech → `Unassigned` project. Cannot be archived.
6. **Archive naming.** `{project_name}_{YYYYMMDD}` where date = day the archive command is spoken.
7. **To-do completion.** Explicit completion language → Claude attempts to auto-link to an open to-do (`completes_todo_id`, with `confidence` field). Fuzzy match, user can override.
8. **Manual to-do close.** Tapping checkbox in UI → inline hours prompt → creates `log_work` entry linked to to-do → closes to-do.

---

## Future phases

### Auth / multi-user
- `user_id` and `org_id` already stamped on every entry and to-do at write time (null until auth wired).
- Users ↔ Orgs: N:N (membership table).
- Each entry visible per org; project visibility scoped to org.
- Recommended path: Azure Static Web Apps built-in auth sets `X-MS-CLIENT-PRINCIPAL` → backend extracts and maps to `X-User-Id` / `X-Org-Id`.

### Conversation loop mode
- After TTS speaks a response, auto-restart the mic (toggle: "conversation mode").
- Pass last N turns as `history[]` to `/voice/process` so Claude has context across the session.
- Enables a full end-of-day debrief by talking, not tapping.
- Cost estimate: ~$0.85/month for 20 sessions × 5 min each (Whisper + Claude + TTS).

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
| `ANTHROPIC_API_KEY` | Azure Function App settings |
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
