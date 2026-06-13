import io
import json
import os
import logging

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
        return func.HttpResponse(
            json.dumps({"transcript": result.text}),
            mimetype="application/json",
            status_code=200,
        )
    except Exception as e:
        logging.error(f"Error during transcription: {e}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500,
        )
