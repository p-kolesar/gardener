const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

async function fetchWithRetry(url, options = {}) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      // Don't retry client errors
      if (res.status >= 400 && res.status < 500) return res;
      if (!res.ok) throw new Error(`${res.status}`);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

async function get(path) {
  const res = await fetchWithRetry(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetchWithRetry(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function apiPatch(path, body) {
  const res = await fetchWithRetry(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export async function getHealth() {
  return get("/health");
}

// Projects
export async function getProjects() {
  return get("/projects");
}

export async function createProject(name) {
  return post("/projects", { name });
}

export async function archiveProject(id) {
  return apiPatch(`/projects/${id}`, { status: "archived" });
}

export async function queryProject(id, type) {
  return post(`/projects/${id}/query`, { type });
}

// Todos
export async function getTodos(projectId, status) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (status) params.set("status", status);
  return get(`/todos?${params}`);
}

export async function createTodo(projectId, description) {
  return post("/todos", { project_id: projectId, description });
}

export async function patchTodo(id, data) {
  return apiPatch(`/todos/${id}`, data);
}

// Entries
export async function getEntries(projectId, type) {
  const params = new URLSearchParams();
  if (projectId) params.set("project_id", projectId);
  if (type) params.set("type", type);
  return get(`/entries?${params}`);
}

export async function transcribeAudio(blob, lang) {
  const langCode = lang.split("-")[0];
  const res = await fetchWithRetry(`${API_BASE}/transcribe?lang=${langCode}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });
  if (!res.ok) throw new Error(`transcribe -> ${res.status}`);
  return res.json(); // { transcript, audio_id }
}

export async function processVoice({
  transcript, project_name, projects, open_todos, today, clarification_context, history,
}) {
  const res = await fetchWithRetry(`${API_BASE}/voice/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript, project_name, projects, open_todos, today, clarification_context, history,
    }),
  });
  if (!res.ok) throw new Error(`voice/process -> ${res.status}`);
  return res.json(); // { confidence, clarification_question, commands }
}

export async function saveEntries(entries) {
  const res = await fetchWithRetry(`${API_BASE}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) throw new Error(`entries -> ${res.status}`);
  return res.json(); // { saved, ids }
}
