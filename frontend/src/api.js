const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export async function getHealth() {
  return get("/health");
}
