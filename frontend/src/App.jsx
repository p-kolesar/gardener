import { useRef, useState, useEffect } from "react";
import { transcribeAudio, processVoice, saveEntries } from "./api.js";

// Hardcoded for now — will come from GET /projects once backend storage is wired
// n:1 with clients: one client may have multiple projects over time.
// Archive naming convention: "{client_name}_{YYYYMMDD}" (closure date).
const PROJECTS = [
  { id: "kovasc", name: "Kováč — Záhrada Marianka" },
  { id: "smith", name: "Smith — Residence Stupava" },
  { id: "novakova", name: "Nováková — Predzáhradka BA" },
  { id: "unassigned", name: "Unassigned" },
];

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
  selectWrap: { position: "relative", marginBottom: 40 },
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
  micArea: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14 },
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
};

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
// ConfirmCard
// ---------------------------------------------------------------------------
function ConfirmCard({ card, onConfirm, onDiscard, clarifyPhase, onClarify }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    if (card.confidence === "high") {
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
      {/* Backdrop */}
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)",
          opacity: visible ? 1 : 0, transition: "opacity 0.3s", zIndex: 10,
        }}
        onClick={isGreen ? onConfirm : undefined}
      />

      {/* Card */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 11,
          background: bg,
          borderTop: `3px solid ${border}`,
          borderRadius: "20px 20px 0 0",
          padding: "22px 20px 36px",
          maxWidth: 600, margin: "0 auto",
          transform: visible ? "translateY(0)" : "translateY(105%)",
          transition: "transform 0.38s cubic-bezier(0.32, 0, 0.15, 1)",
          boxShadow: "0 -6px 28px rgba(0,0,0,0.14)",
        }}
      >
        {/* Countdown bar — green only */}
        {isGreen && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0,
            height: 4, overflow: "hidden",
            borderRadius: "20px 20px 0 0",
          }}>
            <div className="drain-bar" style={{ height: "100%", background: accent, transformOrigin: "left" }} />
          </div>
        )}

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontWeight: 700, color: accent, fontSize: 15 }}>
            {isGreen ? "✓ Got it" : "⚠ Need clarification"}
          </span>
          <button
            style={{ background: "none", border: "none", color: "#999", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}
            onClick={onDiscard}
          >×</button>
        </div>

        {/* Parsed commands */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {card.commands.length === 0
            ? <div style={{ fontSize: 13, color: "#999", fontStyle: "italic" }}>No commands recognized</div>
            : card.commands.map((cmd, i) => (
              <div key={i} style={{
                background: isGreen ? "rgba(46,74,47,0.07)" : "rgba(122,80,0,0.07)",
                borderRadius: 8, padding: "9px 12px",
                fontSize: 13, fontFamily: "'Courier New', monospace", color: "#21251F",
              }}>
                {cmdLabel(cmd)}
              </div>
            ))
          }
        </div>

        {/* Amber: clarification question + actions */}
        {!isGreen && (
          <>
            <div style={{ fontSize: 14, color: accent, fontWeight: 600, marginBottom: 16 }}>
              {card.clarification_question}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  flex: 1, padding: "12px 10px", borderRadius: 10,
                  background: "#2E4A2F", color: "#FBFAF6",
                  border: "none", fontSize: 14, cursor: "pointer", fontFamily: "'Georgia', serif",
                }}
                onClick={onConfirm}
              >
                ✓ Save as-is
              </button>
              <button
                style={{
                  flex: 1, padding: "12px 10px", borderRadius: 10,
                  background: clarifyPhase === "recording" ? "#B4541E" : "#6B4F3A",
                  color: "#FBFAF6", border: "none", fontSize: 14,
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
                style={{
                  padding: "12px 14px", borderRadius: 10,
                  background: "transparent", color: "#B4541E",
                  border: "1px solid #B4541E", fontSize: 14,
                  cursor: "pointer", fontFamily: "'Georgia', serif",
                }}
                onClick={onDiscard}
              >
                Discard
              </button>
            </div>
          </>
        )}

        {isGreen && (
          <div style={{ textAlign: "center", fontSize: 12, color: accent, opacity: 0.65, marginTop: 4 }}>
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
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0]);
  const [lang, setLang] = useState("sk-SK");
  const [phase, setPhase] = useState("idle"); // idle | recording | transcribing | processing
  const [card, setCard] = useState(null);
  const [clarifyPhase, setClarifyPhase] = useState("idle"); // idle | recording | transcribing
  const [err, setErr] = useState(null);
  const [ttsEnabled, setTtsEnabled] = useState(false); // experimental — off by default

  const recRef = useRef(null);
  const clarifyRecRef = useRef(null);
  const lastTranscriptRef = useRef("");

  function speak(text) {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
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
          project_name: selectedProject.name,
          projects: PROJECTS.map(p => p.name),
          open_todos: [],
          today: new Date().toISOString().slice(0, 10),
        });
        setCard({ ...result, audio_id, transcript });
        if (ttsEnabled) speak(result.confidence === "high" ? spokenSummary(result.commands) : result.clarification_question);
      } catch (e) {
        setErr("Error: " + e.message);
      } finally {
        setPhase("idle");
      }
    });
    if (ok) setPhase("recording");
  }

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
          project_name: selectedProject.name,
          projects: PROJECTS.map(p => p.name),
          open_todos: [],
          today: new Date().toISOString().slice(0, 10),
          clarification_context: {
            question: card.clarification_question,
            followup: transcript,
          },
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
    }
    setCard(null);
  }

  function discardCard() {
    setClarifyPhase("idle");
    setCard(null);
  }

  const micIcon = { idle: "🎙", recording: "■", transcribing: "⏳", processing: "⏳" }[phase];
  const busy = phase !== "idle" || card !== null;

  return (
    <div style={S.page}>
      <div style={S.topRow}>
        <div>
          <h1 style={S.h1}>🌿 Terénny denník</h1>
          <div style={S.sub}>Voice → structured log</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
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
        <select
          id="project-select"
          style={S.select}
          value={selectedProject.id}
          onChange={e => setSelectedProject(PROJECTS.find(p => p.id === e.target.value))}
          disabled={busy}
        >
          {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={S.chevron}>▾</span>
      </div>

      <div style={S.micArea}>
        <button
          style={S.micBtn(phase)}
          className={phase === "recording" ? "mic-pulse" : ""}
          onClick={toggleMainRecording}
          disabled={phase === "transcribing" || phase === "processing" || card !== null}
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
