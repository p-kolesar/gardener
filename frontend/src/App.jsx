import { useRef, useState, useEffect } from "react";
import {
  transcribeAudio, processVoice, saveEntries,
  getProjects, createProject, archiveProject, queryProject,
  getTodos, createTodo, patchTodo,
  getEntries,
} from "./api.js";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  page: {
    minHeight: "100vh",
    background: "#FBFAF6",
    color: "#21251F",
    fontFamily: "'Georgia', serif",
    padding: "28px 18px 140px",
    maxWidth: 600,
    margin: "0 auto",
  },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  h1: { fontSize: 22, fontWeight: 700, color: "#2E4A2F", margin: "0 0 3px", letterSpacing: "-0.4px" },
  sub: { fontSize: 12, color: "#6B4F3A" },
  langBtn: {
    fontSize: 11, color: "#6B4F3A", background: "transparent",
    border: "1px solid #C9C6B8", borderRadius: 6, padding: "5px 9px",
    cursor: "pointer", fontFamily: "'Georgia', serif",
  },
  label: { display: "block", fontSize: 12, color: "#6B4F3A", marginBottom: 7, fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase" },
  selectWrap: { position: "relative", marginBottom: 32 },
  select: {
    width: "100%", padding: "13px 40px 13px 14px", fontSize: 16,
    border: "1px solid #C9C6B8", borderRadius: 10,
    background: "#FFFEFA", color: "#21251F",
    fontFamily: "'Georgia', serif", cursor: "pointer",
    appearance: "none", WebkitAppearance: "none",
  },
  chevron: {
    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
    pointerEvents: "none", color: "#6B4F3A", fontSize: 12,
  },
  micArea: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 32 },
  micBtn: (phase) => ({
    width: 88, height: 88, borderRadius: "50%", border: "none",
    background: phase === "recording" ? "#B4541E" : "#2E4A2F",
    color: "#FBFAF6", fontSize: 34, cursor: "pointer",
    transition: "background 0.2s",
    boxShadow: phase === "recording"
      ? "0 0 0 8px rgba(180,84,30,0.18), 0 2px 12px rgba(0,0,0,0.15)"
      : "0 2px 14px rgba(46,74,47,0.25)",
    opacity: (phase === "transcribing" || phase === "processing") ? 0.55 : 1,
  }),
  statusText: { fontSize: 13, color: "#6B4F3A", fontStyle: "italic", minHeight: 20, textAlign: "center" },
  errBox: {
    marginTop: 24, padding: "10px 14px", background: "#FDE8E8",
    borderRadius: 8, fontSize: 13, color: "#B4541E",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  loadingText: { textAlign: "center", fontSize: 13, color: "#6B4F3A", fontStyle: "italic", padding: "24px 0" },
};

// Accordion row styles
const Sr = {
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#6B4F3A", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 },
  row: { borderRadius: 10, border: "1px solid #C9C6B8", marginBottom: 8, overflow: "hidden", background: "#FFFEFA" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", cursor: "pointer", userSelect: "none" },
  headerLeft: { fontWeight: 600, fontSize: 14, color: "#21251F" },
  headerRight: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B4F3A" },
  dot: { color: "#C9C6B8" },
  badge: { background: "#EDF5EC", color: "#2E4A2F", borderRadius: 4, padding: "1px 5px", fontWeight: 600 },
  chevron: { marginLeft: 4, fontSize: 11, color: "#6B4F3A" },
  body: { borderTop: "1px solid #E8E5DA", padding: "12px 14px" },
  subLabel: {
    fontSize: 11, fontWeight: 700, color: "#6B4F3A", textTransform: "uppercase",
    letterSpacing: "0.4px", marginBottom: 7, marginTop: 0,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  subLabelGap: { marginTop: 14 },
  entryRow: { display: "flex", gap: 8, alignItems: "baseline", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #F0EDE5" },
  entryDate: { color: "#6B4F3A", minWidth: 54, flexShrink: 0, fontSize: 11 },
  entryIcon: { flexShrink: 0, width: 14, textAlign: "center" },
  entryAmt: { minWidth: 42, fontWeight: 600, flexShrink: 0 },
  entryDesc: { color: "#555", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  todoRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #F0EDE5", minHeight: 32 },
  completingInner: { display: "flex", alignItems: "center", gap: 6, width: "100%" },
  checkbox: { cursor: "pointer", accentColor: "#2E4A2F", flexShrink: 0, width: 15, height: 15 },
  todoDesc: { fontSize: 13, color: "#21251F", flex: 1 },
  todoDescDone: { fontSize: 13, color: "#999", flex: 1, textDecoration: "line-through" },
  hoursInput: {
    width: 56, padding: "3px 6px", border: "1px solid #C9C6B8", borderRadius: 6,
    fontSize: 12, fontFamily: "Georgia, serif", textAlign: "right",
  },
  confirmBtn: {
    background: "#2E4A2F", color: "#FBFAF6", border: "none",
    borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 12,
  },
  cancelBtn: {
    background: "transparent", color: "#B4541E", border: "1px solid #B4541E",
    borderRadius: 6, padding: "3px 6px", cursor: "pointer", fontSize: 12,
  },
  toggleBtn: {
    background: "transparent", border: "none", cursor: "pointer",
    color: "#6B4F3A", fontSize: 11, textDecoration: "underline", padding: 0, fontFamily: "Georgia, serif",
  },
  empty: { fontSize: 12, color: "#aaa", fontStyle: "italic", padding: "4px 0" },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHASE_LABEL = {
  idle: "",
  recording: "Recording… tap to stop",
  transcribing: "Transcribing…",
  processing: "Parsing with AI…",
};

const CMD_ICON = {
  log_work: "⏱",
  log_material: "€",
  add_todo: "+",
  complete_todo: "✓",
  create_project: "📁",
  archive_project: "📦",
  get_status: "📋",
  get_summary: "📊",
};

function cmdLabel(cmd) {
  const icon = CMD_ICON[cmd.type] ?? "·";
  switch (cmd.type) {
    case "log_work":
      return `${icon} ${cmd.hours} h${cmd.description ? "  ·  " + cmd.description : ""}  →  ${cmd.project_name}`;
    case "log_material":
      return `${icon} €${cmd.euros}${cmd.description ? "  ·  " + cmd.description : ""}  →  ${cmd.project_name}`;
    case "add_todo":
      return `${icon}  ${cmd.description}  →  ${cmd.project_name}`;
    case "complete_todo":
      return `${icon}  ${cmd.description}  →  ${cmd.project_name}`;
    case "create_project":
      return `${icon}  New project: ${cmd.project_name}`;
    case "archive_project":
      return `${icon}  Archive: ${cmd.project_name}`;
    default:
      return `${icon}  ${cmd.type}  →  ${cmd.project_name}`;
  }
}

// ---------------------------------------------------------------------------
// ProjectRow
// ---------------------------------------------------------------------------
function ProjectRow({ project, projectEntries, projectTodos, onReload }) {
  const [expanded, setExpanded] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [completing, setCompleting] = useState({}); // todoId → hours string

  const logEntries = projectEntries
    .filter(e => e.type === "log_work" || e.type === "log_material")
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 30);

  const totalHours = projectEntries
    .filter(e => e.type === "log_work")
    .reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);

  const totalEuros = projectEntries
    .filter(e => e.type === "log_material")
    .reduce((s, e) => s + (parseFloat(e.euros) || 0), 0);

  const openTodos = projectTodos.filter(t => t.status === "open");
  const doneTodos = projectTodos.filter(t => t.status === "done");

  async function completeTodo(todo, hours) {
    try {
      const saved = await saveEntries([{
        type: "log_work",
        project_name: project.name,
        hours: parseFloat(hours) || 0,
        description: `Completed: ${todo.description}`,
        date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(),
      }]);
      const entryId = saved.ids?.[0] || null;
      await patchTodo(todo.id, { status: "done", completed_by_entry_id: entryId });
      setCompleting(prev => { const n = { ...prev }; delete n[todo.id]; return n; });
      onReload();
    } catch (e) {
      console.error("completeTodo failed:", e);
    }
  }

  const hoursDisplay = totalHours > 0 ? `${Math.round(totalHours * 10) / 10}h` : null;
  const eurosDisplay = totalEuros > 0 ? `€${Math.round(totalEuros)}` : null;

  return (
    <div style={Sr.row}>
      <div style={Sr.header} onClick={() => setExpanded(e => !e)}>
        <div style={Sr.headerLeft}>{project.name}</div>
        <div style={Sr.headerRight}>
          {hoursDisplay && <span>{hoursDisplay}</span>}
          {hoursDisplay && eurosDisplay && <span style={Sr.dot}>·</span>}
          {eurosDisplay && <span>{eurosDisplay}</span>}
          {openTodos.length > 0 && (
            <>
              {(hoursDisplay || eurosDisplay) && <span style={Sr.dot}>·</span>}
              <span style={Sr.badge}>{openTodos.length} open</span>
            </>
          )}
          <span style={Sr.chevron}>{expanded ? "▴" : "▾"}</span>
        </div>
      </div>

      {expanded && (
        <div style={Sr.body}>
          {/* Work log */}
          {logEntries.length > 0 && (
            <>
              <div style={Sr.subLabel}>Work log</div>
              {logEntries.map((e, i) => (
                <div key={i} style={Sr.entryRow}>
                  <span style={Sr.entryDate}>{e.date || "—"}</span>
                  <span style={Sr.entryIcon}>{e.type === "log_work" ? "⏱" : "€"}</span>
                  <span style={Sr.entryAmt}>
                    {e.type === "log_work" ? `${e.hours}h` : `€${e.euros}`}
                  </span>
                  <span style={Sr.entryDesc}>{e.description || ""}</span>
                </div>
              ))}
            </>
          )}

          {/* To-dos */}
          <div style={{ ...Sr.subLabel, ...(logEntries.length > 0 ? Sr.subLabelGap : {}) }}>
            <span>To-dos</span>
            {doneTodos.length > 0 && (
              <button style={Sr.toggleBtn} onClick={() => setShowDone(v => !v)}>
                {showDone ? "Hide done" : `Show ${doneTodos.length} done`}
              </button>
            )}
          </div>

          {openTodos.length === 0 && !showDone && (
            <div style={Sr.empty}>No open to-dos</div>
          )}

          {openTodos.map(todo => (
            <div key={todo.id} style={Sr.todoRow}>
              {completing[todo.id] !== undefined ? (
                <div style={Sr.completingInner}>
                  <span style={{ ...Sr.todoDesc, flex: 1 }}>{todo.description}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="hrs"
                    value={completing[todo.id]}
                    onChange={e => setCompleting(prev => ({ ...prev, [todo.id]: e.target.value }))}
                    style={Sr.hoursInput}
                    autoFocus
                  />
                  <button
                    style={Sr.confirmBtn}
                    onClick={() => completeTodo(todo, completing[todo.id])}
                    disabled={!completing[todo.id]}
                  >✓</button>
                  <button
                    style={Sr.cancelBtn}
                    onClick={() => setCompleting(prev => {
                      const n = { ...prev }; delete n[todo.id]; return n;
                    })}
                  >×</button>
                </div>
              ) : (
                <>
                  <input
                    type="checkbox"
                    style={Sr.checkbox}
                    onChange={() => setCompleting(prev => ({ ...prev, [todo.id]: "" }))}
                  />
                  <span style={Sr.todoDesc}>{todo.description}</span>
                </>
              )}
            </div>
          ))}

          {showDone && doneTodos.map(todo => (
            <div key={todo.id} style={{ ...Sr.todoRow, opacity: 0.5 }}>
              <input type="checkbox" checked readOnly style={Sr.checkbox} />
              <span style={Sr.todoDescDone}>{todo.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfirmCard
// ---------------------------------------------------------------------------
function ConfirmCard({ card, onConfirm, onDiscard, clarifyPhase, onClarify }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    if (card.confidence === "high" && !card.queryResult) {
      const t = setTimeout(onConfirm, 4000);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isGreen = card.confidence === "high";
  const accent = isGreen ? "#2E4A2F" : "#7A5000";
  const bg = isGreen ? "#EDF5EC" : "#FFFAED";
  const border = isGreen ? "#A8CCA5" : "#D4A843";

  return (
    <>
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)",
          opacity: visible ? 1 : 0, transition: "opacity 0.3s", zIndex: 10,
        }}
        onClick={isGreen ? onConfirm : undefined}
      />
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 11,
          background: bg, borderTop: `3px solid ${border}`,
          borderRadius: "20px 20px 0 0", padding: "28px 26px 48px",
          maxWidth: 720, margin: "0 auto",
          transform: visible ? "translateY(0)" : "translateY(105%)",
          transition: "transform 0.38s cubic-bezier(0.32, 0, 0.15, 1)",
          boxShadow: "0 -6px 28px rgba(0,0,0,0.14)",
        }}
      >
        {isGreen && !card.queryResult && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, overflow: "hidden", borderRadius: "20px 20px 0 0" }}>
            <div className="drain-bar" style={{ height: "100%", background: accent, transformOrigin: "left" }} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontWeight: 700, color: accent, fontSize: 18 }}>
            {card.queryResult ? "📊 Summary" : isGreen ? "✓ Got it" : "⚠ Need clarification"}
          </span>
          <button
            style={{ background: "none", border: "none", color: "#999", fontSize: 26, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
            onClick={onDiscard}
          >×</button>
        </div>

        {card.queryResult ? (
          <div style={{ fontSize: 15, color: "#21251F", lineHeight: 1.5, marginBottom: 16 }}>
            {typeof card.queryResult === "object" ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 14 }}>
                  {card.queryResult.project_name}
                </div>
                {card.queryResult.work.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Work</div>
                    {card.queryResult.work.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                        <span>{item.description}</span>
                        <span style={{ fontWeight: 600, marginLeft: 12, whiteSpace: "nowrap" }}>{item.hours % 1 === 0 ? item.hours : item.hours.toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                )}
                {card.queryResult.materials.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#6B6B6B", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Materials</div>
                    {card.queryResult.materials.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                        <span>{item.description}</span>
                        <span style={{ fontWeight: 600, marginLeft: 12, whiteSpace: "nowrap" }}>€{item.euros % 1 === 0 ? item.euros : item.euros.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "2px solid rgba(0,0,0,0.15)", fontWeight: 700, fontSize: 15 }}>
                  <span>Total</span>
                  <span>
                    {card.queryResult.total_hours % 1 === 0 ? card.queryResult.total_hours : card.queryResult.total_hours.toFixed(1)}h
                    {card.queryResult.total_euros > 0 && ` · €${card.queryResult.total_euros % 1 === 0 ? card.queryResult.total_euros : card.queryResult.total_euros.toFixed(2)}`}
                  </span>
                </div>
              </>
            ) : card.queryResult}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
            {card.commands.length === 0
              ? <div style={{ fontSize: 15, color: "#999", fontStyle: "italic" }}>No commands recognized</div>
              : card.commands.map((cmd, i) => (
                <div key={i} style={{
                  background: isGreen ? "rgba(46,74,47,0.07)" : "rgba(122,80,0,0.07)",
                  borderRadius: 8, padding: "11px 14px",
                  fontSize: 15, fontFamily: "'Courier New', monospace", color: "#21251F",
                }}>
                  {cmdLabel(cmd)}
                </div>
              ))
            }
          </div>
        )}

        {!isGreen && !card.queryResult && (
          <>
            <div style={{ fontSize: 16, color: accent, fontWeight: 600, marginBottom: 16 }}>
              {card.clarification_question}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{ flex: 1, padding: "14px 10px", borderRadius: 10, background: "#2E4A2F", color: "#FBFAF6", border: "none", fontSize: 16, cursor: "pointer", fontFamily: "'Georgia', serif" }}
                onClick={onConfirm}
              >✓ Save as-is</button>
              <button
                style={{
                  flex: 1, padding: "14px 10px", borderRadius: 10,
                  background: clarifyPhase === "recording" ? "#B4541E" : "#6B4F3A",
                  color: "#FBFAF6", border: "none", fontSize: 16,
                  cursor: clarifyPhase === "transcribing" ? "not-allowed" : "pointer",
                  opacity: clarifyPhase === "transcribing" ? 0.6 : 1,
                  fontFamily: "'Georgia', serif",
                }}
                onClick={onClarify}
                disabled={clarifyPhase === "transcribing"}
              >
                {clarifyPhase === "recording" ? "■ Stop" : clarifyPhase === "transcribing" ? "⏳…" : "🎙 Clarify"}
              </button>
              <button
                style={{ padding: "14px 16px", borderRadius: 10, background: "transparent", color: "#B4541E", border: "1px solid #B4541E", fontSize: 16, cursor: "pointer", fontFamily: "'Georgia', serif" }}
                onClick={onDiscard}
              >Discard</button>
            </div>
          </>
        )}

        {isGreen && !card.queryResult && (
          <div style={{ textAlign: "center", fontSize: 14, color: accent, opacity: 0.65, marginTop: 4 }}>
            Saving automatically — tap anywhere to save now
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [allEntries, setAllEntries] = useState([]);
  const [allTodos, setAllTodos] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [lang, setLang] = useState("sk-SK");
  const [phase, setPhase] = useState("idle");
  const [card, setCard] = useState(null);
  const [clarifyPhase, setClarifyPhase] = useState("idle");
  const [err, setErr] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const [convHistory, setConvHistory] = useState([]);

  const recRef = useRef(null);
  const clarifyRecRef = useRef(null);
  const lastTranscriptRef = useRef("");
  const conversationModeRef = useRef(false);
  const pendingRestartRef = useRef(false);
  const toggleRecordingRef = useRef(null); // always points to latest toggleMainRecording
  const initialLoadRef = useRef(false);

  useEffect(() => { conversationModeRef.current = conversationMode; }, [conversationMode]);

  // Auto-restart mic after TTS when conversation mode is on
  useEffect(() => {
    if (pendingRestartRef.current && phase === "idle" && !card) {
      pendingRestartRef.current = false;
      toggleRecordingRef.current?.();
    }
  }, [phase, card]);

  async function loadAll() {
    try {
      const [ps, es, ts] = await Promise.all([getProjects(), getEntries(), getTodos()]);
      setProjects(ps);
      setAllEntries(es);
      setAllTodos(ts);
      if (!initialLoadRef.current) {
        initialLoadRef.current = true;
        const active = ps.filter(p => p.status === "active");
        const savedId = localStorage.getItem("gardener_project_id");
        const toSelect = (savedId ? active.find(p => p.id === savedId) : null)
          || active.find(p => p.name === "Unassigned")
          || active[0]
          || null;
        setSelectedProject(toSelect);
      } else {
        // After reload (create/archive), keep current selection if still valid
        setSelectedProject(prev => {
          if (!prev) return null;
          const active = ps.filter(p => p.status === "active");
          return active.find(p => p.id === prev.id)
            || active.find(p => p.name === "Unassigned")
            || active[0]
            || null;
        });
      }
    } catch (e) {
      console.error("loadAll failed:", e);
    } finally {
      setProjectsLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist selected project to localStorage
  useEffect(() => {
    if (selectedProject) localStorage.setItem("gardener_project_id", selectedProject.id);
  }, [selectedProject]);

  function speak(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.onend = () => {
      if (conversationModeRef.current) pendingRestartRef.current = true;
    };
    window.speechSynthesis.speak(u);
  }

  function spokenSummary(commands) {
    if (!commands.length) return "Done.";
    return commands.map(cmd => {
      switch (cmd.type) {
        case "log_work":     return `Logged ${cmd.hours} hour${cmd.hours !== 1 ? "s" : ""} on ${cmd.project_name}`;
        case "log_material": return `Logged ${cmd.euros} euros on ${cmd.project_name}`;
        case "add_todo":     return `Added to-do: ${cmd.description}`;
        case "complete_todo":return `Completed: ${cmd.description}`;
        default:             return null;
      }
    }).filter(Boolean).join(". ");
  }

  async function startRecording(ref, onStop) {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setErr("Microphone unavailable: " + e.message);
      return false;
    }
    const chunks = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      onStop(new Blob(chunks, { type: rec.mimeType }));
    };
    ref.current = { recorder: rec };
    rec.start();
    return true;
  }

  // Open todos for the selected project (passed to voice processing)
  const selectedProjectTodos = selectedProject
    ? allTodos.filter(t => t.project_id === selectedProject.id && t.status === "open")
    : [];

  async function toggleMainRecording() {
    if (phase === "recording") {
      recRef.current?.recorder?.stop();
      return;
    }
    setErr(null);
    const ok = await startRecording(recRef, async (blob) => {
      setPhase("transcribing");
      try {
        const { transcript, audio_id } = await transcribeAudio(blob, lang);
        lastTranscriptRef.current = transcript;
        setPhase("processing");
        const result = await processVoice({
          transcript,
          project_name: selectedProject?.name ?? "Unassigned",
          projects: projects.filter(p => p.status === "active").map(p => p.name),
          open_todos: selectedProjectTodos.map(t => ({ id: t.id, description: t.description })),
          today: new Date().toISOString().slice(0, 10),
          history: convHistory.slice(-6),
        });
        setConvHistory(h => [
          ...h,
          { role: "user", content: transcript },
          { role: "assistant", content: JSON.stringify(result.commands) },
        ]);
        setCard({ ...result, audio_id, transcript });
        if (ttsEnabled) {
          speak(result.confidence === "high" ? spokenSummary(result.commands) : result.clarification_question);
        }
      } catch (e) {
        setErr("Error: " + e.message);
      } finally {
        setPhase("idle");
      }
    });
    if (ok) setPhase("recording");
  }

  // Keep ref up to date so auto-restart can call latest version
  useEffect(() => { toggleRecordingRef.current = toggleMainRecording; });

  async function handleClarify() {
    if (clarifyPhase === "recording") {
      clarifyRecRef.current?.recorder?.stop();
      return;
    }
    const ok = await startRecording(clarifyRecRef, async (blob) => {
      setClarifyPhase("transcribing");
      try {
        const { transcript } = await transcribeAudio(blob, lang);
        const result = await processVoice({
          transcript: lastTranscriptRef.current,
          project_name: selectedProject?.name ?? "Unassigned",
          projects: projects.filter(p => p.status === "active").map(p => p.name),
          open_todos: selectedProjectTodos.map(t => ({ id: t.id, description: t.description })),
          today: new Date().toISOString().slice(0, 10),
          clarification_context: { question: card.clarification_question, followup: transcript },
          history: convHistory.slice(-6),
        });
        setCard(prev => ({ ...prev, ...result }));
        if (ttsEnabled) speak(result.confidence === "high" ? spokenSummary(result.commands) : result.clarification_question);
      } catch (e) {
        setErr("Clarification failed: " + e.message);
      } finally {
        setClarifyPhase("idle");
      }
    });
    if (ok) setClarifyPhase("recording");
  }

  async function confirmCard() {
    if (!card) return;

    // If a query result is already displayed, just dismiss
    if (card.queryResult) {
      setCard(null);
      return;
    }

    // Handle AI query commands (get_status / get_summary) — show result in card
    const queryCmd = card.commands.find(c => c.type === "get_status" || c.type === "get_summary");
    if (queryCmd) {
      const project = projects.find(
        p => p.name.toLowerCase() === (queryCmd.project_name ?? "").toLowerCase()
      );
      if (project) {
        try {
          const qtype = queryCmd.type === "get_summary" ? "summary" : "status";
          const { response } = await queryProject(project.id, qtype);
          setCard(prev => ({ ...prev, queryResult: response }));
          if (ttsEnabled) {
            const ttsText = typeof response === "object"
              ? `${response.project_name}. Work: ${response.work.map(w => `${w.description}, ${w.hours} hours`).join(". ")}. Materials: ${response.materials.map(m => `${m.description}, ${m.euros} euros`).join(". ")}. Total: ${response.total_hours} hours, ${response.total_euros} euros.`
              : response;
            speak(ttsText);
          }
        } catch (e) {
          console.error("project query failed:", e);
          setCard(null);
        }
      } else {
        setCard(null);
      }
      return; // Stay on card to show the result
    }

    // Handle create_project
    for (const cmd of card.commands.filter(c => c.type === "create_project")) {
      try {
        await createProject(cmd.project_name);
      } catch (e) { console.error("create_project failed:", e); }
    }

    // Handle archive_project
    for (const cmd of card.commands.filter(c => c.type === "archive_project")) {
      const project = projects.find(
        p => p.status === "active" && p.name.toLowerCase() === (cmd.project_name ?? "").toLowerCase()
      );
      if (project) {
        try {
          await archiveProject(project.id);
        } catch (e) { console.error("archive_project failed:", e); }
      }
    }

    // Save log/todo commands to entries
    const saveable = card.commands.filter(c =>
      ["log_work", "log_material", "add_todo", "complete_todo"].includes(c.type)
    );
    if (saveable.length > 0) {
      try {
        await saveEntries(saveable.map(cmd => ({
          ...cmd,
          audio_id: card.audio_id,
          raw_transcript: card.transcript,
          created_at: new Date().toISOString(),
        })));
      } catch (e) {
        console.error("Save error:", e);
      }

      // Also persist add_todo commands to todos.json
      for (const cmd of saveable.filter(c => c.type === "add_todo")) {
        const project = projects.find(p => p.name === cmd.project_name && p.status === "active");
        if (project) {
          try { await createTodo(project.id, cmd.description); }
          catch (e) { console.error("createTodo failed:", e); }
        }
      }
    }

    const hasChanges = saveable.length > 0 ||
      card.commands.some(c => ["create_project", "archive_project"].includes(c.type));
    if (hasChanges) loadAll();

    setCard(null);
  }

  function discardCard() {
    setClarifyPhase("idle");
    setCard(null);
  }

  // Compute active projects sorted for accordion: alphabetical, Unassigned last
  const accordionProjects = projects
    .filter(p => p.status === "active")
    .sort((a, b) => {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return a.name.localeCompare(b.name);
    });

  const micIcon = { idle: "🎙", recording: "■", transcribing: "⏳", processing: "⏳" }[phase];
  const busy = phase !== "idle" || card !== null;
  const activeProjects = projects.filter(p => p.status === "active");

  return (
    <div style={S.page}>
      <div style={S.topRow}>
        <div>
          <h1 style={S.h1}>🌿 Terénny denník</h1>
          <div style={S.sub}>Voice → structured log</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            style={{ ...S.langBtn, opacity: conversationMode ? 1 : 0.45 }}
            onClick={() => setConversationMode(v => !v)}
            title="Conversation mode — auto-restart mic after TTS"
          >
            {conversationMode ? "💬" : "💬"}
          </button>
          <button
            style={{ ...S.langBtn, opacity: ttsEnabled ? 1 : 0.45 }}
            onClick={() => setTtsEnabled(t => !t)}
            title="Voice responses — experimental"
          >
            {ttsEnabled ? "🔊" : "🔇"}
          </button>
          <button
            style={S.langBtn}
            onClick={() => setLang(l => l === "sk-SK" ? "en-US" : "sk-SK")}
            disabled={busy}
          >
            {lang === "sk-SK" ? "🇸🇰 SK" : "🇬🇧 EN"}
          </button>
        </div>
      </div>

      <label style={S.label} htmlFor="project-select">Project</label>
      <div style={S.selectWrap}>
        {projectsLoading ? (
          <div style={{ ...S.select, display: "flex", alignItems: "center", color: "#999" }}>
            Loading…
          </div>
        ) : (
          <select
            id="project-select"
            style={S.select}
            value={selectedProject?.id ?? ""}
            onChange={e => setSelectedProject(activeProjects.find(p => p.id === e.target.value) ?? null)}
            disabled={busy}
          >
            {activeProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <span style={S.chevron}>▾</span>
      </div>

      <div style={S.micArea}>
        <button
          style={S.micBtn(phase)}
          className={phase === "recording" ? "mic-pulse" : ""}
          onClick={toggleMainRecording}
          disabled={phase === "transcribing" || phase === "processing" || card !== null || projectsLoading}
          aria-label={phase === "recording" ? "Stop recording" : "Start recording"}
        >
          {micIcon}
        </button>
        <div style={S.statusText}>{PHASE_LABEL[phase]}</div>
      </div>

      {err && (
        <div style={S.errBox}>
          <span>{err}</span>
          <button
            style={{ background: "none", border: "none", color: "#B4541E", cursor: "pointer", fontSize: 16, padding: 0 }}
            onClick={() => setErr(null)}
          >×</button>
        </div>
      )}

      {/* Project accordion */}
      {!projectsLoading && (
        <div style={Sr.section}>
          {accordionProjects.map(project => {
            const projectEntries = allEntries.filter(e => e.project_name === project.name);
            const projectTodos = allTodos.filter(t => t.project_id === project.id);
            return (
              <ProjectRow
                key={project.id}
                project={project}
                projectEntries={projectEntries}
                projectTodos={projectTodos}
                onReload={loadAll}
              />
            );
          })}
        </div>
      )}

      {card && (
        <ConfirmCard
          card={card}
          onConfirm={confirmCard}
          onDiscard={discardCard}
          clarifyPhase={clarifyPhase}
          onClarify={handleClarify}
        />
      )}
    </div>
  );
}
