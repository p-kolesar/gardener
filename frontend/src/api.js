const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export async function getHealth() {
  return get("/health");
}

export async function transcribeAudio(blob, lang) {
  const langCode = lang.split("-")[0];
  const res = await fetch(`${API_BASE}/transcribe?lang=${langCode}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });
  if (!res.ok) throw new Error(`transcribe -> ${res.status}`);
  return res.json();
}
