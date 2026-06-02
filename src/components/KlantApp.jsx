import { useState, useEffect } from "react";

function useFonts() {
  useEffect(() => {
    const el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap";
    document.head.appendChild(el);
  }, []);
}

// ── Theme ──────────────────────────────────────────────────────────────────
const T = {
  bg: "#0E0E0E", surf: "#161616", surf2: "#1E1E1E", surf3: "#242424",
  border: "#2A2A2A", accent: "#E8520A", accentSoft: "#E8520A22",
  text: "#F0ECE6", muted: "#666660", green: "#22C55E", yellow: "#F59E0B", red: "#EF4444",
};

// ── Mock klantdata ─────────────────────────────────────────────────────────
const KLANT = {
  naam: "Pieter de Vries",
  email: "pieter@mail.nl",
};

const INIT_MOTOREN = [
  {
    id: 1, kenteken: "TH-123-B", merk: "Honda", model: "CB500F",
    bouwjaar: 2019, aankoopdatum: "2024-03-15",
    kmHistory: [
      { datum: "2024-03-15", km: 12000 },
      { datum: "2024-07-01", km: 14500 },
      { datum: "2024-11-15", km: 16800 },
      { datum: "2025-03-10", km: 18500 },
      { datum: "2025-09-20", km: 21200 },
      { datum: "2026-02-14", km: 23800 },
    ],
    service: [
      { id: 1, datum: "2024-06-10", omschrijving: "Olie vervangen, luchtfilter gereinigd", km: 14200 },
      { id: 2, datum: "2025-01-15", omschrijving: "APK + ketting gespannen, remvloeistof bijgevuld", km: 17100 },
      { id: 3, datum: "2025-09-22", omschrijving: "Grote beurt: banden, remmen, vloeistoffen", km: 21300 },
    ],
    intervalKm: 5000,
    lastServiceKm: 21300,
  },
  {
    id: 2, kenteken: "TH-456-C", merk: "Yamaha", model: "MT-07",
    bouwjaar: 2021, aankoopdatum: "2025-02-20",
    kmHistory: [
      { datum: "2025-02-20", km: 6800 },
      { datum: "2025-08-10", km: 8200 },
    ],
    service: [],
    intervalKm: 6000,
    lastServiceKm: 0,
  },
];

// Afspraken die al bezet zijn (gedeeld met admin)
const BEZETTE_DAGEN = ["2026-05-28", "2026-05-29", "2026-05-30"];

// ── Utils ──────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split("T")[0];
const DAGEN_NL = ["zo","ma","di","wo","do","vr","za"];
const MAANDEN_NL = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

const fmtDatum = d => {
  const dt = new Date(d);
  return `${dt.getDate()} ${MAANDEN_NL[dt.getMonth()]} ${dt.getFullYear()}`;
};

// Haal beschikbare wo/do/vr dagen op voor de komende 6 weken
const getBeschikbareDagen = (bezet) => {
  const dagen = [];
  const start = new Date(TODAY);
  start.setDate(start.getDate() + 1);
  for (let i = 0; dagen.length < 24; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (i > 28) break;
    const dayOfWeek = d.getDay();
    if ([3,4,5].includes(dayOfWeek)) {
      const iso = d.toISOString().split("T")[0];
      dagen.push({ datum: iso, bezet: bezet.includes(iso), dag: DAGEN_NL[dayOfWeek] });
    }
  }
  return dagen;
};

// ── Shared UI ──────────────────────────────────────────────────────────────
const css = {
  app: { maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: T.bg, fontFamily: "Barlow, sans-serif", color: T.text, display: "flex", flexDirection: "column", position: "relative" },
  topBar: { padding: "18px 20px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  logoWrap: { display: "flex", flexDirection: "column" },
  logoTop: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 17, letterSpacing: 2, color: T.text, lineHeight: 1 },
  logoSub: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: 3, color: T.accent, marginTop: 2 },
  scroll: { flex: 1, overflowY: "auto", padding: "20px 20px 90px" },
  bottomNav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: T.surf, borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 50 },
  navBtn: (a) => ({ flex: 1, padding: "10px 4px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", background: "none", border: "none", color: a ? T.accent : T.muted, fontFamily: "Barlow, sans-serif" }),
  navIcon: { fontSize: 20 },
  navLabel: (a) => ({ fontSize: 10, letterSpacing: 0.5, fontWeight: a ? 600 : 400 }),
  card: { background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
  cardAccent: { background: T.surf, border: `1px solid ${T.accent}40`, borderRadius: 10, padding: 16, marginBottom: 12 },
  sectionTitle: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, color: T.muted, textTransform: "uppercase", marginBottom: 12 },
  bigNum: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 38, color: T.accent, lineHeight: 1 },
  motorTitle: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 24, lineHeight: 1 },
  badge: (c) => ({ display: "inline-block", padding: "3px 9px", borderRadius: 3, fontSize: 11, fontWeight: 700, background: `${c}22`, color: c, letterSpacing: 0.5 }),
  input: { background: T.surf2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "11px 14px", color: T.text, fontSize: 15, fontFamily: "Barlow, sans-serif", outline: "none", width: "100%", boxSizing: "border-box" },
  btn: { width: "100%", padding: "13px", background: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif" },
  btnGhost: { width: "100%", padding: "13px", background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 15, cursor: "pointer", fontFamily: "Barlow, sans-serif" },
};

function MotorSelector({ motoren, selected, onSelect }) {
  if (motoren.length <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {motoren.map(m => (
        <button key={m.id} onClick={() => onSelect(m.id)}
          style={{ flex: 1, padding: "9px 8px", borderRadius: 6, border: `1px solid ${selected === m.id ? T.accent : T.border}`, background: selected === m.id ? T.accentSoft : "transparent", color: selected === m.id ? T.accent : T.muted, cursor: "pointer", fontFamily: "Barlow, sans-serif", fontSize: 12, fontWeight: selected === m.id ? 600 : 400 }}>
          {m.merk} {m.model}
        </button>
      ))}
    </div>
  );
}

// ── Scherm: Mijn Motor ─────────────────────────────────────────────────────
function MijnMotor({ motoren, onMotorUpdate }) {
  const [selId, setSelId] = useState(motoren[0]?.id);
  const motor = motoren.find(m => m.id === selId) || motoren[0];
  if (!motor) return <div style={{ color: T.muted, textAlign: "center", marginTop: 60, fontSize: 14 }}>Geen motor gekoppeld</div>;

  const huidigKm = motor.kmHistory.length ? motor.kmHistory[motor.kmHistory.length - 1].km : 0;
  const kmSindsBeurt = motor.lastServiceKm ? huidigKm - motor.lastServiceKm : null;
  const intervalPct = kmSindsBeurt !== null ? Math.min(100, Math.round(kmSindsBeurt / motor.intervalKm * 100)) : null;
  const statusColor = intervalPct === null ? T.muted : intervalPct >= 90 ? T.red : intervalPct >= 70 ? T.yellow : T.green;

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selId} onSelect={setSelId} />

      {/* Motor card */}
      <div style={{ ...css.card, background: `linear-gradient(135deg, ${T.surf} 60%, ${T.accent}12)`, border: `1px solid ${T.accent}30`, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={css.motorTitle}>{motor.merk}</div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 18, color: T.muted, marginTop: 2 }}>{motor.model}</div>
          </div>
          <span style={css.badge(T.accent)}>{motor.kenteken}</span>
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
          {[
            { lbl: "Bouwjaar", val: motor.bouwjaar },
            { lbl: "In bezit sinds", val: motor.aankoopdatum.substring(0, 4) },
            { lbl: "Huidige stand", val: `${huidigKm.toLocaleString()} km` },
          ].map((x, i) => (
            <div key={i}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>{x.lbl}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{x.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Onderhoudsinterval */}
      <div style={css.card}>
        <div style={css.sectionTitle}>Onderhoudsinterval</div>
        {intervalPct === null ? (
          <div style={{ fontSize: 13, color: T.muted }}>Nog geen service geregistreerd</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: T.muted }}>Km sinds laatste beurt</div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 22, color: statusColor, marginTop: 2 }}>
                  {kmSindsBeurt.toLocaleString()} km
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}><button onClick={()=>import("../lib/supabase.js").then(m=>m.uitloggen())} style={{background:"none",border:"none",color:"#666660",fontSize:12,cursor:"pointer",fontFamily:"Barlow, sans-serif"}}>Uitloggen</button><div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: T.muted }}>Interval</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>per {motor.intervalKm.toLocaleString()} km</div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ background: T.surf2, borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${intervalPct}%`, height: "100%", background: statusColor, borderRadius: 4, transition: "width 0.4s" }} />
            </div>
            <div style={{ fontSize: 12, color: statusColor, marginTop: 8, fontWeight: 600 }}>
              {intervalPct >= 100 ? "⚠ Onderhoud nodig!" : intervalPct >= 70 ? `Bijna tijd — nog ${(motor.intervalKm - kmSindsBeurt).toLocaleString()} km` : `Goed — nog ${(motor.intervalKm - kmSindsBeurt).toLocaleString()} km`}
            </div>
          </>
        )}
      </div>

      {/* Laatste service */}
      {motor.service.length > 0 && (
        <div style={css.card}>
          <div style={css.sectionTitle}>Laatste service</div>
          <div style={{ fontSize: 12, color: T.accent, marginBottom: 4 }}>{motor.service[motor.service.length - 1].datum}</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{motor.service[motor.service.length - 1].omschrijving}</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>bij {motor.service[motor.service.length - 1].km?.toLocaleString()} km</div>
        </div>
      )}
    </div>
  );
}

// ── Scherm: Servicegeschiedenis ────────────────────────────────────────────
function Servicegeschiedenis({ motoren }) {
  const [selId, setSelId] = useState(motoren[0]?.id);
  const motor = motoren.find(m => m.id === selId) || motoren[0];
  if (!motor) return null;

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selId} onSelect={setSelId} />
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 16 }}>
        {motor.merk} {motor.model}
        <span style={{ ...css.badge(T.accent), marginLeft: 10, fontSize: 10 }}>{motor.kenteken}</span>
      </div>
      {motor.service.length === 0 ? (
        <div style={css.card}>
          <div style={{ color: T.muted, fontSize: 14, textAlign: "center", padding: "20px 0" }}>Nog geen servicebeurten geregistreerd</div>
        </div>
      ) : (
        motor.service.slice().reverse().map((sv, i) => (
          <div key={sv.id} style={{ display: "flex", gap: 14, marginBottom: 4 }}>
            {/* Timeline lijn */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.accent, marginTop: 4, flexShrink: 0 }} />
              {i < motor.service.length - 1 && <div style={{ width: 1, flex: 1, background: T.border, minHeight: 20, marginTop: 4 }} />}
            </div>
            <div style={{ ...css.card, flex: 1, marginBottom: i < motor.service.length - 1 ? 0 : 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: T.accent, fontWeight: 600 }}>{sv.datum}</div>
                {sv.km && <div style={{ fontSize: 11, color: T.muted }}>{sv.km.toLocaleString()} km</div>}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{sv.omschrijving}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Scherm: Km Stand ───────────────────────────────────────────────────────
function KmStand({ motoren, onUpdate }) {
  const [selId, setSelId] = useState(motoren[0]?.id);
  const [nieuwKm, setNieuwKm] = useState("");
  const [opgeslagen, setOpgeslagen] = useState(false);
  const motor = motoren.find(m => m.id === selId) || motoren[0];
  if (!motor) return null;

  const huidigKm = motor.kmHistory.length ? motor.kmHistory[motor.kmHistory.length - 1].km : 0;

  const opslaan = () => {
    const km = parseInt(nieuwKm);
    if (!km || km <= huidigKm) return;
    const nieuwEntry = { datum: TODAY, km };
    onUpdate(selId, { kmHistory: [...motor.kmHistory, nieuwEntry] });
    setNieuwKm("");
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2500);
  };

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selId} onSelect={id => { setSelId(id); setOpgeslagen(false); }} />

      {/* Huidige stand */}
      <div style={css.cardAccent}>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Huidige kilometerstand</div>
        <div style={css.bigNum}>{huidigKm.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>km · {motor.merk} {motor.model}</div>
      </div>

      {/* Invoer */}
      <div style={css.card}>
        <div style={css.sectionTitle}>Nieuwe stand invoeren</div>
        <input style={{ ...css.input, fontSize: 22, fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, letterSpacing: 1, textAlign: "center", marginBottom: 12 }}
          type="number" value={nieuwKm} onChange={e => setNieuwKm(e.target.value)}
          placeholder={`meer dan ${huidigKm.toLocaleString()}`} />
        {nieuwKm && parseInt(nieuwKm) <= huidigKm && (
          <div style={{ fontSize: 12, color: T.red, marginBottom: 10 }}>⚠ Moet hoger zijn dan huidige stand ({huidigKm.toLocaleString()} km)</div>
        )}
        {opgeslagen ? (
          <div style={{ ...css.btn, background: T.green, textAlign: "center", borderRadius: 8, padding: 13, fontSize: 15, fontWeight: 600, cursor: "default" }}>✓ Opgeslagen!</div>
        ) : (
          <button style={{ ...css.btn, opacity: (!nieuwKm || parseInt(nieuwKm) <= huidigKm) ? 0.4 : 1 }} onClick={opslaan}>Opslaan</button>
        )}
      </div>

      {/* Historie */}
      <div style={css.card}>
        <div style={css.sectionTitle}>Kilometerhistorie</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {motor.kmHistory.slice().reverse().map((entry, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < motor.kmHistory.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: T.muted }}>{entry.datum}</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 16 }}>{entry.km.toLocaleString()} km</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Scherm: Afspraak ───────────────────────────────────────────────────────
function Afspraak({ motoren }) {
  const [selId, setSelId] = useState(motoren[0]?.id);
  const [selDatum, setSelDatum] = useState(null);
  const [opmerking, setOpmerking] = useState("");
  const [verstuurd, setVerstuurd] = useState(false);
  const motor = motoren.find(m => m.id === selId) || motoren[0];
  const beschikbaar = getBeschikbareDagen(BEZETTE_DAGEN);

  const DAGVOL = { wo: "Woensdag", do: "Donderdag", vr: "Vrijdag" };

  const verstuur = () => {
    if (!selDatum) return;
    setVerstuurd(true);
  };

  if (verstuurd) {
    return (
      <div style={{ textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 8 }}>Aanvraag verstuurd!</div>
        <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.8, maxWidth: 280, margin: "0 auto" }}>
          We nemen contact met je op om de afspraak te bevestigen.
        </div>
        <div style={{ ...css.card, marginTop: 24, textAlign: "left" }}>
          <div style={{ fontSize: 12, color: T.accent, marginBottom: 4 }}>Gevraagde datum</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{fmtDatum(selDatum)}</div>
          {motor && <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{motor.merk} {motor.model} · {motor.kenteken}</div>}
          {opmerking && <div style={{ fontSize: 13, color: T.muted, marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>{opmerking}</div>}
        </div>
        <button style={{ ...css.btnGhost, marginTop: 12 }} onClick={() => { setVerstuurd(false); setSelDatum(null); setOpmerking(""); }}>
          Nieuwe aanvraag
        </button>
      </div>
    );
  }

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selId} onSelect={setSelId} />

      {/* Info banner */}
      <div style={{ background: T.accentSoft, border: `1px solid ${T.accent}40`, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, lineHeight: 1.7, color: T.text }}>
        Door drukte kan de tijd uitlopen — we bellen je als de motor klaar is. 🔧
      </div>

      {/* Datum kiezen */}
      <div style={css.card}>
        <div style={css.sectionTitle}>Kies een dag</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {beschikbaar.map(d => (
            <button key={d.datum} onClick={() => !d.bezet && setSelDatum(d.datum)} disabled={d.bezet}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 6, border: `1px solid ${selDatum === d.datum ? T.accent : d.bezet ? T.border : T.border}`, background: selDatum === d.datum ? T.accentSoft : d.bezet ? T.surf2 : "transparent", cursor: d.bezet ? "default" : "pointer", fontFamily: "Barlow, sans-serif" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 1, color: d.bezet ? T.muted : selDatum === d.datum ? T.accent : T.text, textTransform: "uppercase", width: 24 }}>
                  {d.dag}
                </div>
                <div style={{ fontSize: 14, color: d.bezet ? T.muted : T.text }}>{fmtDatum(d.datum)}</div>
              </div>
              {d.bezet ? (
                <span style={css.badge(T.muted)}>Vol</span>
              ) : selDatum === d.datum ? (
                <span style={css.badge(T.accent)}>✓</span>
              ) : (
                <span style={{ fontSize: 12, color: T.muted }}>Vrij</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Opmerking */}
      <div style={css.card}>
        <div style={css.sectionTitle}>Opmerking (optioneel)</div>
        <textarea style={{ ...css.input, height: 80, resize: "none" }}
          placeholder="Beschrijf kort wat je wil laten doen..."
          value={opmerking} onChange={e => setOpmerking(e.target.value)} />
      </div>

      <button style={{ ...css.btn, opacity: !selDatum ? 0.4 : 1, marginTop: 4 }} onClick={verstuur}>
        Afspraak aanvragen
      </button>
    </div>
  );
}

// ── Scherm: Contact ────────────────────────────────────────────────────────
const TIJDEN = { ma:"09–17", di:"09–17", wo:"09–17", do:"09–17", vr:"09–17", za:"10–15", zo:null };
const GESLOTEN_WEKEN = ["2026-06-01"]; // maandagen van gesloten weken — straks uit backend

function WeekKalender() {
  // Bouw 2 weken op
  const ma = new Date(TODAY);
  const dow = ma.getDay();
  ma.setDate(ma.getDate() - (dow === 0 ? 6 : dow - 1));

  const weken = [0, 1].map(offset => {
    const start = new Date(ma);
    start.setDate(ma.getDate() + offset * 7);
    const maStr = start.toISOString().split("T")[0];
    const isGesloten = GESLOTEN_WEKEN.includes(maStr);
    const dagen = ["ma","di","wo","do","vr","za","zo"].map((dag, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const isVandaag = iso === TODAY;
      return { dag, datum: d.getDate(), iso, isVandaag, tijd: isGesloten ? null : TIJDEN[dag] };
    });
    const fmt = d => `${d.getDate()} ${MAANDEN_NL[d.getMonth()]}`;
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { label: offset === 0 ? "Deze week" : "Volgende week", periode: `${fmt(start)} – ${fmt(end)}`, isGesloten, dagen };
  });

  return (
    <div style={{ ...css.card, marginTop: 8 }}>
      <div style={css.sectionTitle}>Openingstijden</div>
      {weken.map((week, wi) => (
        <div key={wi} style={{ marginBottom: wi === 0 ? 18 : 0 }}>
          {/* Week header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{week.label}</span>
              <span style={{ fontSize: 11, color: T.muted, marginLeft: 6 }}>{week.periode}</span>
            </div>
            {week.isGesloten && <span style={{ ...css.badge(T.red), fontSize: 10 }}>Gesloten</span>}
          </div>
          {/* Dag blokjes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {week.dagen.map(d => (
              <div key={d.dag} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 10, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase" }}>{d.dag}</div>
                <div style={{
                  width: "100%", borderRadius: 6, padding: "7px 4px",
                  background: d.isVandaag ? T.accentSoft : week.isGesloten || !d.tijd ? T.surf2 : T.surf3,
                  border: `1px solid ${d.isVandaag ? T.accent : week.isGesloten || !d.tijd ? T.border : T.border}`,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2
                }}>
                  <div style={{ fontSize: 13, fontWeight: d.isVandaag ? 700 : 500, color: d.isVandaag ? T.accent : T.text }}>{d.datum}</div>
                  <div style={{ fontSize: 9, color: week.isGesloten || !d.tijd ? T.muted : T.green, fontWeight: 600, letterSpacing: 0.3 }}>
                    {week.isGesloten ? "—" : d.tijd || "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {wi === 0 && <div style={{ borderBottom: `1px solid ${T.border}`, marginTop: 16 }} />}
        </div>
      ))}
      <div style={{ fontSize: 11, color: T.muted, marginTop: 12, lineHeight: 1.6 }}>
        Afwijkende tijden worden hier op tijd aangegeven.
      </div>
    </div>
  );
}

function Contact() {
  return (
    <div>
      <div style={{ ...css.card, background: `linear-gradient(135deg, ${T.surf} 60%, ${T.accent}10)`, border: `1px solid ${T.accent}30`, marginBottom: 20 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 1 }}>DE JONGE</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: 3, color: T.accent, marginTop: 2 }}>MOTOREN</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 10, lineHeight: 1.8 }}>
          Tholen · Ma–Za 09:00–17:00
        </div>
      </div>

      {[
        { icon: "📞", label: "Bellen", sub: "Direct contact", href: "tel:+31140000000", color: T.accent },
        { icon: "💬", label: "WhatsApp", sub: "Stuur een bericht", href: "https://wa.me/31140000000", color: "#25D366" },
        { icon: "✉", label: "E-mail", sub: "dejongemotor@email.nl", href: "mailto:info@dejongemotor.nl", color: T.muted },
      ].map((c, i) => (
        <a key={i} href={c.href}
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 10, textDecoration: "none", color: T.text }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${c.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            {c.icon}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: c.color }}>{c.label}</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{c.sub}</div>
          </div>
          <div style={{ marginLeft: "auto", color: T.muted, fontSize: 16 }}>→</div>
        </a>
      ))}

      <WeekKalender />
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function KlantApp({ userId }) {

  const [tab, setTab] = useState("motor");
  const [motoren, setMotoren] = useState(INIT_MOTOREN);

  const updateMotor = (id, updates) => {
    setMotoren(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const nav = [
    { id: "motor", icon: "🏍", label: "Mijn Motor" },
    { id: "service", icon: "🔧", label: "Service" },
    { id: "km", icon: "📍", label: "Km Stand" },
    { id: "afspraak", icon: "📅", label: "Afspraak" },
    { id: "contact", icon: "📞", label: "Contact" },
  ];

  const titles = { motor: "Mijn Motor", service: "Servicegeschiedenis", km: "Km Stand", afspraak: "Afspraak", contact: "Contact" };

  return (
    <div style={css.app}>
      {/* Top bar */}
      <div style={css.topBar}>
        <div style={css.logoWrap}>
          <div style={css.logoTop}>DE JONGE MOTOREN</div>
          <div style={css.logoSub}>MIJN GARAGE</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}><button onClick={()=>import("../lib/supabase.js").then(m=>m.uitloggen())} style={{background:"none",border:"none",color:"#666660",fontSize:12,cursor:"pointer",fontFamily:"Barlow, sans-serif"}}>Uitloggen</button><div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{KLANT.naam.split(" ")[0]}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{motoren.length} motor{motoren.length !== 1 ? "en" : ""}</div>
        </div>
      </div>

      {/* Paginatitel */}
      <div style={{ padding: "14px 20px 0" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: 0.5 }}>
          {titles[tab]}
        </div>
      </div>

      {/* Content */}
      <div style={css.scroll}>
        {tab === "motor" && <MijnMotor motoren={motoren} onMotorUpdate={updateMotor} />}
        {tab === "service" && <Servicegeschiedenis motoren={motoren} />}
        {tab === "km" && <KmStand motoren={motoren} onUpdate={updateMotor} />}
        {tab === "afspraak" && <Afspraak motoren={motoren} />}
        {tab === "contact" && <Contact />}
      </div>

      {/* Bottom nav */}
      <nav style={css.bottomNav}>
        {nav.map(n => (
          <button key={n.id} style={css.navBtn(tab === n.id)} onClick={() => setTab(n.id)}>
            <span style={css.navIcon}>{n.icon}</span>
            <span style={{ fontSize: 9, letterSpacing: 0.3, fontWeight: tab === n.id ? 600 : 400 }}>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
