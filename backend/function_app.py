import io
import json
import logging
import os
import uuid

import azure.functions as func

logging.basicConfig(level=logging.INFO)
app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({"status": "ok"}),
        mimetype="application/json",
        status_code=200,
    )


@app.route(route="transcribe", methods=["POST"])
def transcribe(req: func.HttpRequest) -> func.HttpResponse:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return func.HttpResponse(
            json.dumps({"error": "OPENAI_API_KEY not configured"}),
            mimetype="application/json",
            status_code=500,
        )

    audio_data = req.get_body()
    if not audio_data:
        return func.HttpResponse(
            json.dumps({"error": "No audio data"}),
            mimetype="application/json",
            status_code=400,
        )

    lang = req.params.get("lang", "sk")
    content_type = req.headers.get("Content-Type", "audio/webm").split(";")[0].strip()
    ext = {"audio/webm": "webm", "audio/ogg": "ogg", "audio/wav": "wav",
           "audio/mp4": "mp4", "audio/mpeg": "mp3"}.get(content_type, "webm")

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
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500,
        )

    # Save audio blob — best effort, never fail the transcription over it
    audio_id = None
    try:
        from storage.blobs import upload
        audio_id = str(uuid.uuid4())
        upload("audio", f"{audio_id}.{ext}", audio_data)
    except Exception as e:
        logging.warning(f"Audio storage failed (non-fatal): {e}")

    return func.HttpResponse(
        json.dumps({"transcript": result.text, "audio_id": audio_id}),
        mimetype="application/json",
        status_code=200,
    )


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
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return func.HttpResponse(
            json.dumps({"error": "ANTHROPIC_API_KEY not configured"}),
            mimetype="application/json",
            status_code=500,
        )

    try:
        body = req.get_json()
    except Exception:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body"}),
            mimetype="application/json",
            status_code=400,
        )

    transcript = body.get("transcript", "")
    project_name = body.get("project_name", "Unassigned")
    projects = body.get("projects", [])
    open_todos = body.get("open_todos", [])
    today = body.get("today", "")
    clarification_context = body.get("clarification_context")

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

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system,
            messages=[{"role": "user", "content": f'Transcript: """{transcript}"""'}],
        )
        raw = msg.content[0].text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        result = json.loads(raw)
        return func.HttpResponse(
            json.dumps(result),
            mimetype="application/json",
            status_code=200,
        )
    except json.JSONDecodeError:
        logging.warning("Claude returned non-JSON — returning low-confidence fallback")
        return func.HttpResponse(
            json.dumps({
                "confidence": "low",
                "clarification_question": "I couldn't quite understand that — could you try again with more detail?",
                "commands": [],
            }),
            mimetype="application/json",
            status_code=200,
        )
    except Exception as e:
        logging.error(f"voice/process error: {e}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500,
        )


@app.route(route="entries", methods=["POST"])
def save_entries(req: func.HttpRequest) -> func.HttpResponse:
    try:
        body = req.get_json()
        new_entries = body.get("entries", [])
    except Exception:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON body"}),
            mimetype="application/json",
            status_code=400,
        )

    if not new_entries:
        return func.HttpResponse(
            json.dumps({"saved": 0}),
            mimetype="application/json",
            status_code=200,
        )

    try:
        from storage.blobs import upload, download
        # Stamp identity fields on every entry at write time.
        # Values come from headers (future auth middleware will set these);
        # null is fine for now — never omit the fields so queries can always filter on them.
        user_id = req.headers.get("X-User-Id") or None
        org_id = req.headers.get("X-Org-Id") or None
        for entry in new_entries:
            entry.setdefault("user_id", user_id)
            entry.setdefault("org_id", org_id)
        try:
            existing = json.loads(download("data", "entries.json"))
        except Exception:
            existing = []
        existing.extend(new_entries)
        upload("data", "entries.json", json.dumps(existing, ensure_ascii=False).encode())
        return func.HttpResponse(
            json.dumps({"saved": len(new_entries)}),
            mimetype="application/json",
            status_code=200,
        )
    except Exception as e:
        logging.error(f"entries save error: {e}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500,
        )
