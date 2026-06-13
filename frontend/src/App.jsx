import { useState } from "react";

// ---- Design tokens: "field notebook" ----
// moss #2E4A2F, soil #6B4F3A, paper #FBFAF6, ink #21251F, marker #D8E8D0, alert #B4541E
const S = {
  page: { minHeight: "100vh", background: "#FBFAF6", color: "#21251F", fontFamily: "'Georgia', serif", padding: "24px 16px", maxWidth: 760, margin: "0 auto" },
  mono: { fontFamily: "'Courier New', monospace" },
  h1: { fontSize: 26, fontWeight: 700, color: "#2E4A2F", margin: 0, letterSpacing: "-0.5px" },
  sub: { fontSize: 13, color: "#6B4F3A", marginTop: 4 },
  card: { background: "#fff", border: "1px solid #E2E0D6", borderRadius: 10, padding: 16, marginTop: 16 },
  chip: { display: "inline-block", background: "#D8E8D0", color: "#2E4A2F", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontFamily: "'Courier New', monospace", marginRight: 6, marginBottom: 4 },
  btn: { background: "#2E4A2F", color: "#FBFAF6", border: "none", borderRadius: 8, padding: "12px 18px", fontSize: 15, cursor: "pointer", fontFamily: "'Georgia', serif" },
  ghost: { background: "transparent", color: "#2E4A2F", border: "1px dashed #2E4A2F", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer", marginRight: 8, marginBottom: 8, textAlign: "left" },
  ta: { width: "100%", boxSizing: "border-box", minHeight: 90, border: "1px solid #C9C6B8", borderRadius: 8, padding: 12, fontSize: 15, fontFamily: "'Georgia', serif", background: "#FFFEFA", resize: "vertical" },
};

const SAMPLES = [
  "Skončil som u pána Kováča, strihanie živého plota, 3 a pol hodiny, použil som 2 vrecia mulča a pol litra benzínu do plotostriha. Budúci týždeň treba doniesť postrek proti voškám na ruže.",
  "Just finished at the Smith place, mowed the lawn and edged the beds, took about 2 hours. Used one tank of mower fuel. Mrs Smith wants a quote for a new flower bed by the patio, maybe 6 square meters.",
  "Bol som u Novákovej, vysadil som 12 levandúľ a 3 ruže, 4 hodiny aj s prípravou pôdy. Materiál: levandule 12 kusov, ruže 3 kusy, 50 litrov substrátu. Pozor — nechce kosiť pred deviatou ráno.",
];

const CLIENTS = ["Kováč — Záhrada Marianka", "Smith — Residence Stupava", "Nováková — Predzáhradka BA"];

export default function App() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState([]);
  const [err, setErr] = useState(null);
  const [recording, setRecording] = useState(false);
  const [lang, setLang] = useState("sk-SK");
  const [recRef] = useState({ current: null });

  function toggleRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr("Tento prehliadač nepodporuje Web Speech API (skús Chrome/Edge)."); return; }
    if (recording) { recRef.current?.stop(); setRecording(false); return; }
    setErr(null);
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = text ? text + " " : "";
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setText((finalText + interim).trim());
    };
    rec.onerror = (ev) => {
      setRecording(false);
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed")
        setErr("Mikrofón zablokovaný sandboxom/permission — použi textový vstup, alebo nasaď appku vo vlastnom prostredí.");
      else setErr("Speech error: " + ev.error);
    };
    rec.onend = () => setRecording(false);
    try { rec.start(); recRef.current = rec; setRecording(true); }
    catch (e) { setErr("Nepodarilo sa spustiť mikrofón: " + e.message); }
  }

  async function parseNote() {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are the parsing engine of a gardener's voice-logging app. Existing clients/projects: ${JSON.stringify(CLIENTS)}.

Parse this voice note transcript into structured JSON. Match to an existing client if names overlap (fuzzy match on surname); otherwise propose a new client string. Respond ONLY with raw JSON, no markdown fences, no preamble:

{
 "client": "matched or new client/project name",
 "isNewClient": boolean,
 "tasksDone": ["short task descriptions"],
 "hours": number or null,
 "materials": [{"item": "...", "qty": "..."}],
 "followUps": ["actionable follow-up items"],
 "clientPreferences": ["any preferences/constraints mentioned"] ,
 "language": "sk" or "en",
 "invoiceLines": [{"desc":"...", "type":"labor|material"}]
}

Transcript: """${text}"""`
          }],
        }),
      });
      const data = await res.json();
      const raw = data.content.map(b => b.text || "").join("\n");
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setEntries(e => [{ ...parsed, ts: new Date().toLocaleTimeString(), transcript: text }, ...e]);
      setText("");
    } catch (e) {
      setErr("Parsing failed — try again. " + e.message);
    } finally { setBusy(false); }
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>🌿 Terénny denník</h1>
      <div style={S.sub}>Voice → structured log demo · hovor po slovensky alebo anglicky</div>

      <div style={S.card}>
        <div style={{ fontSize: 13, color: "#6B4F3A", marginBottom: 8 }}>
          🎙️ Simulácia hlasovej poznámky (v reálnej appke: speech-to-text). Vyber vzorku alebo napíš vlastnú:
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {SAMPLES.map((s, i) => (
            <button key={i} style={S.ghost} onClick={() => setText(s)}>„{s.slice(0, 80)}…"</button>
          ))}
        </div>
        <textarea style={S.ta} value={text} onChange={e => setText(e.target.value)}
          placeholder="Skončil som u pána Kováča, 3 hodiny, strihanie plota…" />
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{ ...S.btn, background: recording ? "#B4541E" : "#6B4F3A" }} onClick={toggleRecording}>
            {recording ? "■ Stop nahrávania" : "🎙️ Nahrať hlasom"}
          </button>
          <button style={{ ...S.ghost, marginBottom: 0 }} onClick={() => setLang(l => l === "sk-SK" ? "en-US" : "sk-SK")}>
            {lang === "sk-SK" ? "🇸🇰 sk-SK" : "🇬🇧 en-US"}
          </button>
          <button style={{ ...S.btn, opacity: busy ? 0.6 : 1 }} onClick={parseNote} disabled={busy}>
            {busy ? "Spracúvam…" : "Zapísať do denníka →"}
          </button>
        </div>
        {err && <div style={{ color: "#B4541E", fontSize: 13, marginTop: 8 }}>{err}</div>}
      </div>

      {entries.length === 0 && (
        <div style={{ ...S.card, borderStyle: "dashed", color: "#6B4F3A", fontSize: 14 }}>
          Denník je prázdny. Nahraj prvú poznámku — AI ju roztriedi ku klientovi, vyráta hodiny, materiál a follow-upy.
        </div>
      )}

      {entries.map((e, i) => (
        <div key={i} style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 700, color: "#2E4A2F", fontSize: 16 }}>
              📁 {e.client} {e.isNewClient && <span style={{ ...S.chip, background: "#F3E3D3", color: "#B4541E" }}>NOVÝ KLIENT</span>}
            </div>
            <div style={{ ...S.mono, fontSize: 11, color: "#999" }}>{e.ts}</div>
          </div>

          <div style={{ marginTop: 10 }}>
            {e.hours != null && <span style={S.chip}>⏱ {e.hours} h</span>}
            <span style={S.chip}>{e.language === "sk" ? "🇸🇰 SK" : "🇬🇧 EN"}</span>
          </div>

          {e.tasksDone?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <b>Práce:</b> {e.tasksDone.join(" · ")}
            </div>
          )}

          {e.materials?.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 14 }}>
              <b>Materiál:</b> {e.materials.map(m => `${m.item} (${m.qty})`).join(", ")}
            </div>
          )}

          {e.followUps?.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 14, color: "#B4541E" }}>
              <b>⚑ Follow-up:</b> {e.followUps.join(" · ")}
            </div>
          )}

          {e.clientPreferences?.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 13, fontStyle: "italic", color: "#6B4F3A" }}>
              ☝ Preferencie klienta: {e.clientPreferences.join("; ")}
            </div>
          )}

          {e.invoiceLines?.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "#2E4A2F" }}>Návrh fakturačných položiek ({e.invoiceLines.length})</summary>
              <ul style={{ ...S.mono, fontSize: 12, paddingLeft: 18, marginTop: 6 }}>
                {e.invoiceLines.map((l, j) => <li key={j}>[{l.type}] {l.desc}</li>)}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
