import datetime
import io
import json
import logging
import os
import uuid

import azure.functions as func

logging.basicConfig(level=logging.INFO)
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _read_json(container, blob_name):
    from storage.blobs import download
    try:
        return json.loads(download(container, blob_name))
    except Exception:
        return []


def _write_json(container, blob_name, data):
    from storage.blobs import upload
    upload(container, blob_name, json.dumps(data, ensure_ascii=False).encode())


def _ok(data, status=200):
    return func.HttpResponse(
        json.dumps(data, ensure_ascii=False),
        mimetype="application/json",
        status_code=status,
    )


def _err(msg, status=400):
    return func.HttpResponse(
        json.dumps({"error": msg}),
        mimetype="application/json",
        status_code=status,
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return _ok({"status": "ok"})


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
@app.route(route="projects", methods=["GET"])
def get_projects(req: func.HttpRequest) -> func.HttpResponse:
    projects = _read_json("data", "projects.json")
    if not projects:
        unassigned = {
            "id": str(uuid.uuid4()),
            "name": "Unassigned",
            "status": "active",
            "created_at": _now(),
        }
        projects = [unassigned]
        _write_json("data", "projects.json", projects)
    return _ok(projects)


@app.route(route="projects", methods=["POST"])
def create_project(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except Exception:
        return _err("Invalid JSON", 400)
    name = (body.get("name") or "").strip()
    if not name:
        return _err("name required", 400)
    project = {
        "id": str(uuid.uuid4()),
        "name": name,
        "status": "active",
        "created_at": _now(),
    }
    projects = _read_json("data", "projects.json")
    projects.append(project)
    _write_json("data", "projects.json", projects)
    return _ok(project, 201)


@app.route(route="projects/{id}", methods=["PATCH"])
def patch_project(req: func.HttpRequest) -> func.HttpResponse:
    project_id = req.route_params.get("id")
    try:
        body = req.get_json()
    except Exception:
        return _err("Invalid JSON", 400)
    projects = _read_json("data", "projects.json")
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project:
        return _err("not found", 404)
    if body.get("status") == "archived":
        date_str = datetime.date.today().strftime("%Y%m%d")
        project["name"] = f"{project['name']}_{date_str}"
        project["status"] = "archived"
        project["archived_at"] = _now()
    else:
        for field in ("name", "status"):
            if field in body:
                project[field] = body[field]
    _write_json("data", "projects.json", projects)
    return _ok(project)


# ---------------------------------------------------------------------------
# Project AI query
# ---------------------------------------------------------------------------
@app.route(route="projects/{id}/query", methods=["POST"])
def project_query(req: func.HttpRequest) -> func.HttpResponse:
    project_id = req.route_params.get("id")
    try:
        body = req.get_json()
    except Exception:
        return _err("Invalid JSON", 400)
    query_type = body.get("type", "summary")

    projects = _read_json("data", "projects.json")
    project = next((p for p in projects if p["id"] == project_id), None)
    if not project:
        return _err("not found", 404)

    pname = project["name"]
    entries = _read_json("data", "entries.json")
    todos = _read_json("data", "todos.json")
    project_entries = [
        e for e in entries
        if e.get("project_name") == pname and e.get("type") in ("log_work", "log_material")
    ]
    project_todos = [t for t in todos if t.get("project_id") == project_id]

    if query_type == "status":
        api_key = os.environ.get("CLAUDE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            return _err("CLAUDE_API_KEY not configured", 500)
        open_todos = [t for t in project_todos if t.get("status") == "open"]
        system_prompt = (
            f"You are a concise assistant for a gardening contractor. "
            f"Summarize what work is still open/remaining for project '{pname}' in 2–3 sentences. "
            f"Be specific about what needs to be done."
        )
        user_msg = f"Open to-dos: {json.dumps(open_todos, ensure_ascii=False)}"
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            msg = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=512,
                system=system_prompt,
                messages=[{"role": "user", "content": user_msg}],
            )
            text = next(b.text for b in msg.content if b.type == "text")
            return _ok({"response": text.strip()})
        except Exception as e:
            logging.error(f"project_query error: {e}")
            return _err(str(e), 500)

    # summary — aggregate entries directly, no LLM needed
    from collections import defaultdict
    work_agg = defaultdict(float)
    for e in project_entries:
        if e.get("type") == "log_work":
            desc = (e.get("description") or "Work").strip()
            work_agg[desc] += float(e.get("hours") or 0)

    material_agg = defaultdict(float)
    for e in project_entries:
        if e.get("type") == "log_material":
            desc = (e.get("description") or "Material").strip()
            material_agg[desc] += float(e.get("euros") or 0)

    work_items = sorted(
        [{"description": d, "hours": h} for d, h in work_agg.items() if h > 0],
        key=lambda x: x["hours"], reverse=True
    )[:3]
    material_items = sorted(
        [{"description": d, "euros": e} for d, e in material_agg.items() if e > 0],
        key=lambda x: x["euros"], reverse=True
    )[:3]

    total_hours = sum(float(e.get("hours") or 0) for e in project_entries if e.get("type") == "log_work")
    total_euros = sum(float(e.get("euros") or 0) for e in project_entries if e.get("type") == "log_material")

    return _ok({"response": {
        "project_name": pname,
        "work": work_items,
        "materials": material_items,
        "total_hours": total_hours,
        "total_euros": total_euros,
    }})


# ---------------------------------------------------------------------------
# Todos
# ---------------------------------------------------------------------------
@app.route(route="todos", methods=["GET"])
def get_todos(req: func.HttpRequest) -> func.HttpResponse:
    project_id = req.params.get("project_id")
    status_filter = req.params.get("status")
    todos = _read_json("data", "todos.json")
    if project_id:
        todos = [t for t in todos if t.get("project_id") == project_id]
    if status_filter:
        todos = [t for t in todos if t.get("status") == status_filter]
    return _ok(todos)


@app.route(route="todos", methods=["POST"])
def create_todo(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
    except Exception:
        return _err("Invalid JSON", 400)
    todo = {
        "id": str(uuid.uuid4()),
        "project_id": body.get("project_id"),
        "description": body.get("description", ""),
        "status": "open",
        "created_at": _now(),
        "completed_at": None,
        "completed_by_entry_id": None,
    }
    todos = _read_json("data", "todos.json")
    todos.append(todo)
    _write_json("data", "todos.json", todos)
    return _ok(todo, 201)


@app.route(route="todos/{id}", methods=["PATCH"])
def patch_todo(req: func.HttpRequest) -> func.HttpResponse:
    todo_id = req.route_params.get("id")
    try:
        body = req.get_json()
    except Exception:
        return _err("Invalid JSON", 400)
    todos = _read_json("data", "todos.json")
    todo = next((t for t in todos if t["id"] == todo_id), None)
    if not todo:
        return _err("not found", 404)
    for field in ("status", "completed_at", "completed_by_entry_id", "description"):
        if field in body:
            todo[field] = body[field]
    if body.get("status") == "done" and not todo.get("completed_at"):
        todo["completed_at"] = _now()
    _write_json("data", "todos.json", todos)
    return _ok(todo)


# ---------------------------------------------------------------------------
# Transcribe
# ---------------------------------------------------------------------------
@app.route(route="transcribe", methods=["POST"])
def transcribe(req: func.HttpRequest) -> func.HttpResponse:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return _err("OPENAI_API_KEY not configured", 500)

    audio_data = req.get_body()
    if not audio_data:
        return _err("No audio data", 400)

    lang = req.params.get("lang", "sk")
    content_type = req.headers.get("Content-Type", "audio/webm").split(";")[0].strip()
    ext = {
        "audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav",
        "audio/mp4": "mp4", "audio/mpeg": "mp3",
    }.get(content_type, "webm")

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        buf = io.BytesIO(audio_data)
        buf.name = f"audio.{ext}"
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=buf,
            language=lang,
        )
    except Exception as e:
        logging.error(f"Transcription error: {e}")
        return _err(str(e), 500)

    audio_id = None
    try:
        from storage.blobs import upload
        audio_id = str(uuid.uuid4())
        upload("audio", f"{audio_id}.{ext}", audio_data)
    except Exception as e:
        logging.warning(f"Audio storage failed (non-fatal): {e}")

    return _ok({"transcript": result.text, "audio_id": audio_id})


# ---------------------------------------------------------------------------
# Voice process
# ---------------------------------------------------------------------------
_VOICE_SYSTEM = """You are the parsing engine of a gardener's voice-logging app.

Today: {today}
Selected project (user's active choice): {project_name}
All known projects: {projects}
Open to-dos: {open_todos}

Parse the transcript into structured commands. Return ONLY valid JSON — no markdown fences, no explanation:

{{
  "confidence": "high" | "low",
  "clarification_question": "string or null — only set when confidence is low",
  "commands": [
    {{
      "type": "log_work" | "log_material" | "add_todo" | "complete_todo" | "create_project" | "archive_project" | "get_status" | "get_summary",
      "project_name": "string",
      "hours": number | null,
      "euros": number | null,
      "description": "string | null",
      "date": "YYYY-MM-DD",
      "completes_todo_id": "string | null"
    }}
  ]
}}

Rules:
- Default (no keyword) = log_work if hours mentioned, log_material if euros/currency mentioned
- "need to", "should", "plan to", "get", "buy", "acquire", "order" → add_todo
- ONLY "finished", "completed", "done", "all done", "wrapped up" → completion. Never "worked on", "was doing", "started"
- Use selected project as default; only override if another project is clearly stated
- One transcript can produce multiple commands
- If project name is ambiguous between known projects → confidence: "low" with clarification_question
- If project_name and amounts are unambiguous → confidence: "high"
{clarification_section}"""


@app.route(route="voice/process", methods=["POST"])
def voice_process(req: func.HttpRequest) -> func.HttpResponse:
    api_key = os.environ.get("CLAUDE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _err("CLAUDE_API_KEY not configured", 500)

    try:
        body = req.get_json()
    except Exception:
        return _err("Invalid JSON body", 400)

    transcript = body.get("transcript", "")
    project_name = body.get("project_name", "Unassigned")
    projects = body.get("projects", [])
    open_todos = body.get("open_todos", [])
    today = body.get("today", "")
    clarification_context = body.get("clarification_context")
    history = body.get("history", [])  # list of {role, content} for conversation mode

    clarification_section = ""
    if clarification_context:
        q = clarification_context.get("question", "")
        followup = clarification_context.get("followup", "")
        clarification_section = (
            f'\nClarification context: you previously asked "{q}". '
            f'The user responded: "{followup}". Use this to resolve ambiguity in the original transcript.'
        )

    system = _VOICE_SYSTEM.format(
        today=today,
        project_name=project_name,
        projects=json.dumps(projects),
        open_todos=json.dumps(open_todos),
        clarification_section=clarification_section,
    )

    # Build messages: inject up to 3 prior turns (6 entries) then the current transcript.
    # Ensure the sequence starts with "user" as Claude requires.
    prior = [t for t in history[-6:] if t.get("role") in ("user", "assistant")]
    while prior and prior[0].get("role") != "user":
        prior.pop(0)
    messages = [{"role": t["role"], "content": str(t.get("content", ""))} for t in prior]
    messages.append({"role": "user", "content": f'Transcript: """{transcript}"""'})

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system,
            messages=messages,  # type: ignore[arg-type]
        )
        raw = next(b.text for b in msg.content if b.type == "text").strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        result = json.loads(raw)
        return _ok(result)
    except json.JSONDecodeError:
        logging.warning("Claude returned non-JSON — returning low-confidence fallback")
        return _ok({
            "confidence": "low",
            "clarification_question": "I couldn't quite understand that — could you try again with more detail?",
            "commands": [],
        })
    except Exception as e:
        logging.error(f"voice/process error: {e}")
        return _err(str(e), 500)


# ---------------------------------------------------------------------------
# Entries
# ---------------------------------------------------------------------------
@app.route(route="entries", methods=["GET"])
def get_entries_list(req: func.HttpRequest) -> func.HttpResponse:
    project_id = req.params.get("project_id")
    entry_type = req.params.get("type")
    entries = _read_json("data", "entries.json")
    if project_id:
        projects = _read_json("data", "projects.json")
        project = next((p for p in projects if p["id"] == project_id), None)
        if project:
            pname = project["name"]
            entries = [e for e in entries if e.get("project_name") == pname]
        else:
            entries = []
    if entry_type:
        entries = [e for e in entries if e.get("type") == entry_type]
    return _ok(entries)


@app.route(route="entries", methods=["POST"])
def save_entries(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
        new_entries = body.get("entries", [])
    except Exception:
        return _err("Invalid JSON body", 400)

    if not new_entries:
        return _ok({"saved": 0, "ids": []})

    try:
        from storage.blobs import upload, download
        user_id = req.headers.get("X-User-Id") or None
        org_id = req.headers.get("X-Org-Id") or None
        for entry in new_entries:
            entry.setdefault("id", str(uuid.uuid4()))
            entry.setdefault("user_id", user_id)
            entry.setdefault("org_id", org_id)
        try:
            existing = json.loads(download("data", "entries.json"))
        except Exception:
            existing = []
        existing.extend(new_entries)
        upload("data", "entries.json", json.dumps(existing, ensure_ascii=False).encode())
        return _ok({"saved": len(new_entries), "ids": [e["id"] for e in new_entries]})
    except Exception as e:
        logging.error(f"entries save error: {e}")
        return _err(str(e), 500)
