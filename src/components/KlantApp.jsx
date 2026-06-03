import { useState, useEffect } from "react";

// ── Theme ──────────────────────────────────────────────────────────────────
const T = {
  bg: "#0E0E0E", surf: "#161616", surf2: "#1E1E1E", surf3: "#242424",
  border: "#2A2A2A", accent: "#E8520A", accentSoft: "#E8520A22",
  text: "#F0ECE6", muted: "#666660", green: "#22C55E", yellow: "#F59E0B", red: "#EF4444",
};

// ── Utils ──────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split("T")[0];
const DAGEN_NL = ["zo","ma","di","wo","do","vr","za"];
const MAANDEN_NL = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

const fmtDatum = d => {
  const dt = new Date(d);
  return `${dt.getDate()} ${MAANDEN_NL[dt.getMonth()]} ${dt.getFullYear()}`;
};

const getBeschikbareDagen = (bezet = []) => {
  const dagen = [];
  const start = new Date(TODAY);
  start.setDate(start.getDate() + 1);
  for (let i = 0; dagen.length < 12; i++) {
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
  app: { maxWidth: 430, margin: "0 auto", minHeight: "100dvh", background: T.bg, fontFamily: "Barlow, sans-serif", color: T.text, display: "flex", flexDirection: "column", position: "relative" },
  topBar: { padding: "14px 16px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  logoWrap: { display: "flex", flexDirection: "column" },
  logoTop: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 17, letterSpacing: 2, color: T.text, lineHeight: 1 },
  logoSub: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: 3, color: T.accent, marginTop: 2 },
  scroll: { flex: 1, overflowY: "auto", padding: "20px 20px 90px" },
  bottomNav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: T.surf, borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 50 },
  navBtn: (a) => ({ flex: 1, padding: "10px 4px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", background: "none", border: "none", color: a ? T.accent : T.muted, fontFamily: "Barlow, sans-serif" }),
  card: { background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
  cardAccent: { background: T.surf, border: `1px solid ${T.accent}40`, borderRadius: 10, padding: 16, marginBottom: 12 },
  sectionTitle: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, color: T.muted, textTransform: "uppercase", marginBottom: 12 },
  bigNum: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 38, color: T.accent, lineHeight: 1 },
  motorTitle: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 24, lineHeight: 1 },
  badge: (c) => ({ display: "inline-block", padding: "3px 9px", borderRadius: 3, fontSize: 11, fontWeight: 700, background: `${c}22`, color: c, letterSpacing: 0.5 }),
  input: { background: T.surf2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "11px 14px", color: T.text, fontSize: 16, fontFamily: "Barlow, sans-serif", outline: "none", width: "100%", boxSizing: "border-box" },
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
function MijnMotor({ motoren }) {
  const [selId, setSelId] = useState(motoren[0]?.id);
  const motor = motoren.find(m => m.id === selId) || motoren[0];
  if (!motor) return <div style={{ color: T.muted, textAlign: "center", marginTop: 60, fontSize: 14 }}>Geen motor gekoppeld</div>;

  const huidigKm = motor.kmHistory.length ? motor.kmHistory[motor.kmHistory.length - 1].km : 0;
  const lastServiceKm = motor.last_service_km || 0;
  const intervalKm = motor.interval_km || 5000;
  const kmSindsBeurt = (lastServiceKm > 0 && motor.service?.length > 0) ? huidigKm - lastServiceKm : null;
  const intervalPct = kmSindsBeurt !== null ? Math.min(100, Math.round(kmSindsBeurt / intervalKm * 100)) : null;
  const statusColor = intervalPct === null ? T.muted : intervalPct >= 90 ? T.red : intervalPct >= 70 ? T.yellow : T.green;

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selId} onSelect={setSelId} />

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
            { lbl: "Bouwjaar", val: motor.bouwjaar || "—" },
            { lbl: "In bezit sinds", val: motor.aankoopdatum?.substring(0, 4) || "—" },
            { lbl: "Huidige stand", val: `${huidigKm.toLocaleString()} km` },
          ].map((x, i) => (
            <div key={i}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: "uppercase" }}>{x.lbl}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3 }}>{x.val}</div>
            </div>
          ))}
        </div>
      </div>

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
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: T.muted }}>Interval</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>per {intervalKm.toLocaleString()} km</div>
              </div>
            </div>
            <div style={{ background: T.surf2, borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${intervalPct}%`, height: "100%", background: statusColor, borderRadius: 4, transition: "width 0.4s" }} />
            </div>
            <div style={{ fontSize: 12, color: statusColor, marginTop: 8, fontWeight: 600 }}>
              {intervalPct >= 100 ? "⚠ Onderhoud nodig!" : intervalPct >= 70 ? `Bijna tijd — nog ${(intervalKm - kmSindsBeurt).toLocaleString()} km` : `Goed — nog ${(intervalKm - kmSindsBeurt).toLocaleString()} km`}
            </div>
          </>
        )}
      </div>

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
function KmStand({ motoren, onSlaOp }) {
  const [selId, setSelId] = useState(motoren[0]?.id);
  const [nieuwKm, setNieuwKm] = useState("");
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const motor = motoren.find(m => m.id === selId) || motoren[0];
  if (!motor) return null;

  const huidigKm = motor.kmHistory.length ? motor.kmHistory[motor.kmHistory.length - 1].km : 0;

  const opslaan = async () => {
    const km = parseInt(nieuwKm);
    if (!km || km <= huidigKm) return;
    setBezig(true);
    await onSlaOp(motor.id, km);
    setNieuwKm("");
    setOpgeslagen(true);
    setBezig(false);
    setTimeout(() => setOpgeslagen(false), 2500);
  };

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selId} onSelect={id => { setSelId(id); setOpgeslagen(false); }} />

      <div style={css.cardAccent}>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Huidige kilometerstand</div>
        <div style={css.bigNum}>{huidigKm.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>km · {motor.merk} {motor.model}</div>
      </div>

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
          <button style={{ ...css.btn, opacity: (!nieuwKm || parseInt(nieuwKm) <= huidigKm || bezig) ? 0.4 : 1 }} onClick={opslaan}>
            {bezig ? "Opslaan..." : "Opslaan"}
          </button>
        )}
      </div>

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
function Afspraak({ motoren, bezetteDagen = [], onSlaOp }) {
  const [selId, setSelId] = useState(motoren[0]?.id);
  const [selDatum, setSelDatum] = useState(null);
  const [notitie, setNotitie] = useState("");
  const [verstuurd, setVerstuurd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const motor = motoren.find(m => m.id === selId) || motoren[0];
  const beschikbaar = getBeschikbareDagen(bezetteDagen);

  const verstuur = async () => {
    if (!selDatum || bezig) return;
    setBezig(true);
    await onSlaOp({ motorId: selId, datum: selDatum, opmerking: notitie });
    setBezig(false);
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
          {notitie && <div style={{ fontSize: 13, color: T.muted, marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>{notitie}</div>}
        </div>
        <button style={{ ...css.btnGhost, marginTop: 12 }} onClick={() => { setVerstuurd(false); setSelDatum(null); setNotitie(""); }}>
          Nieuwe aanvraag
        </button>
      </div>
    );
  }

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selId} onSelect={setSelId} />

      <div style={{ background: T.accentSoft, border: `1px solid ${T.accent}40`, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, lineHeight: 1.7, color: T.text }}>
        Door drukte kan de tijd uitlopen — we bellen je als de motor klaar is. 🔧
      </div>

      <div style={css.card}>
        <div style={css.sectionTitle}>Kies een dag</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {beschikbaar.map(d => (
            <button key={d.datum} onClick={() => !d.bezet && setSelDatum(d.datum)} disabled={d.bezet}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: 6, border: `1px solid ${selDatum === d.datum ? T.accent : T.border}`, background: selDatum === d.datum ? T.accentSoft : d.bezet ? T.surf2 : "transparent", cursor: d.bezet ? "default" : "pointer", fontFamily: "Barlow, sans-serif" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 1, color: d.bezet ? T.muted : selDatum === d.datum ? T.accent : T.text, textTransform: "uppercase", width: 24 }}>
                  {d.dag}
                </div>
                <div style={{ fontSize: 14, color: d.bezet ? T.muted : T.text }}>{fmtDatum(d.datum)}</div>
              </div>
              {d.bezet ? <span style={css.badge(T.muted)}>Vol</span> : selDatum === d.datum ? <span style={css.badge(T.accent)}>✓</span> : <span style={{ fontSize: 12, color: T.muted }}>Vrij</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={css.card}>
        <div style={css.sectionTitle}>Opmerking (optioneel)</div>
        <textarea style={{ ...css.input, height: 80, resize: "none" }}
          placeholder="Beschrijf kort wat je wil laten doen..."
          value={notitie} onChange={e => setNotitie(e.target.value)} />
      </div>

      <button style={{ ...css.btn, opacity: !selDatum || bezig ? 0.4 : 1, marginTop: 4 }} onClick={verstuur}>
        {bezig ? "Versturen..." : "Afspraak aanvragen"}
      </button>
    </div>
  );
}

// ── Scherm: Contact ────────────────────────────────────────────────────────
const DEFAULT_TIJDEN = { ma:"09–17", di:"09–17", wo:"09–17", do:"09–17", vr:"09–17", za:"10–15", zo:null };

function WeekKalender({ openingstijden, geslotenDagen = [] }) {
  const getTijd = (dag) => {
    if (!openingstijden || !openingstijden[dag]) return DEFAULT_TIJDEN[dag];
    if (openingstijden[dag].gesloten) return null;
    const o = openingstijden[dag].open?.substring(0,5) || "09:00";
    const s = openingstijden[dag].sluit?.substring(0,5) || "17:00";
    return `${o.replace(":",".")}–${s.replace(":",".")}`;
  };

  const ma = new Date(TODAY);
  const dow = ma.getDay();
  ma.setDate(ma.getDate() - (dow === 0 ? 6 : dow - 1));

  const weken = [0, 1].map(offset => {
    const start = new Date(ma);
    start.setDate(ma.getDate() + offset * 7);
    const dagen = ["ma","di","wo","do","vr","za","zo"].map((dag, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().split("T")[0];
      const isVandaag = iso === TODAY;
      const isGesloten = geslotenDagen.includes(iso);
      return { dag, datum: d.getDate(), iso, isVandaag, tijd: isGesloten ? null : getTijd(dag), gesloten: isGesloten };
    });
    const fmt = d => `${d.getDate()} ${MAANDEN_NL[d.getMonth()]}`;
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const weekGesloten = dagen.every(d => !d.tijd);
    return { label: offset === 0 ? "Deze week" : "Volgende week", periode: `${fmt(start)} – ${fmt(end)}`, weekGesloten, dagen };
  });

  return (
    <div style={{ ...css.card, marginTop: 8 }}>
      <div style={css.sectionTitle}>Openingstijden</div>
      {weken.map((week, wi) => (
        <div key={wi} style={{ marginBottom: wi === 0 ? 18 : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{week.label}</span>
              <span style={{ fontSize: 11, color: T.muted, marginLeft: 6 }}>{week.periode}</span>
            </div>
            {week.weekGesloten && <span style={{ ...css.badge(T.red), fontSize: 10 }}>Gesloten</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {week.dagen.map(d => (
              <div key={d.dag} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 10, color: T.muted, letterSpacing: 0.5, textTransform: "uppercase" }}>{d.dag}</div>
                <div style={{ width: "100%", borderRadius: 6, padding: "7px 4px", background: d.isVandaag ? T.accentSoft : !d.tijd ? T.surf2 : T.surf3, border: `1px solid ${d.isVandaag ? T.accent : T.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: d.isVandaag ? 700 : 500, color: d.isVandaag ? T.accent : T.text }}>{d.datum}</div>
                  <div style={{ fontSize: 9, color: !d.tijd ? T.muted : T.green, fontWeight: 600, letterSpacing: 0.3 }}>{d.tijd || "—"}</div>
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

function Contact({ openingstijden, geslotenDagen, opmerking }) {
  return (
    <div>
      {opmerking ? (
        <div style={{ background: `${T.red}18`, border: `1px solid ${T.red}50`, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 13, lineHeight: 1.7, color: T.red, fontWeight: 600 }}>
          ⚠ {opmerking}
        </div>
      ) : null}
      <div style={{ ...css.card, background: `linear-gradient(135deg, ${T.surf} 60%, ${T.accent}10)`, border: `1px solid ${T.accent}30`, marginBottom: 20 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 1 }}>DE JONGE</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, fontSize: 12, letterSpacing: 3, color: T.accent, marginTop: 2 }}>MOTOREN</div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 10, lineHeight: 1.8 }}>Motorspecialist · Tholen</div>
      </div>
      {[
        { icon: "📞", label: "Bellen", sub: "Direct contact", href: "tel:+31140000000", color: T.accent },
        { icon: "💬", label: "WhatsApp", sub: "Stuur een bericht", href: "https://wa.me/31140000000", color: "#25D366" },
        { icon: "✉", label: "E-mail", sub: "dejongemotor@email.nl", href: "mailto:info@dejongemotor.nl", color: T.muted },
      ].map((c, i) => (
        <a key={i} href={c.href}
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 10, textDecoration: "none", color: T.text }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${c.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{c.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: c.color }}>{c.label}</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{c.sub}</div>
          </div>
          <div style={{ marginLeft: "auto", color: T.muted, fontSize: 16 }}>→</div>
        </a>
      ))}
      <WeekKalender openingstijden={openingstijden} geslotenDagen={geslotenDagen} />
    </div>
  );
}

// ── Scherm: Instellingen (profiel + motors) ────────────────────────────────
function Instellingen({ klant, motoren, onUpdateKlant, onVoegMotorToe, onVerwijderMotor, onWijzigWachtwoord }) {
  const [profiel, setProfiel] = useState({
    naam: klant.naam || "", telefoon: klant.telefoon || "",
    adres: klant.adres || "", postcode: klant.postcode || "", woonplaats: klant.woonplaats || "",
  });
  const [profielBezig, setProfielBezig] = useState(false);
  const [profielOk, setProfielOk] = useState(false);
  const [profielFout, setProfielFout] = useState(null);

  const [ww, setWw] = useState({ nieuw: "", herhaal: "" });
  const [wwBezig, setWwBezig] = useState(false);
  const [wwOk, setWwOk] = useState(false);
  const [wwFout, setWwFout] = useState(null);

  const leegMotorForm = { kenteken: "", merk: "", model: "", bouwjaar: "", aankoopdatum: "", beginkm: "" };
  const [motorForm, setMotorForm] = useState(leegMotorForm);
  const [motorBezig, setMotorBezig] = useState(false);
  const [motorOk, setMotorOk] = useState(false);
  const [motorFout, setMotorFout] = useState(null);
  const [toonMotorForm, setToonMotorForm] = useState(false);
  const [rdwBezig, setRdwBezig] = useState(false);
  const [rdwFout, setRdwFout] = useState(null);

  const [verwijderBevestigId, setVerwijderBevestigId] = useState(null);
  const [verwijderBezig, setVerwijderBezig] = useState(false);
  const [verwijderFout, setVerwijderFout] = useState(null);

  const slaProfielOp = async () => {
    setProfielBezig(true); setProfielFout(null);
    const err = await onUpdateKlant(profiel);
    setProfielBezig(false);
    if (err) { setProfielFout(err); return; }
    setProfielOk(true);
    setTimeout(() => setProfielOk(false), 2500);
  };

  const wijzigWw = async () => {
    if (!ww.nieuw || ww.nieuw.length < 8) { setWwFout("Wachtwoord minimaal 8 tekens."); return; }
    if (ww.nieuw !== ww.herhaal) { setWwFout("Wachtwoorden komen niet overeen."); return; }
    setWwBezig(true); setWwFout(null);
    const err = await onWijzigWachtwoord(ww.nieuw);
    setWwBezig(false);
    if (err) { setWwFout(err); return; }
    setWwOk(true);
    setWw({ nieuw: "", herhaal: "" });
    setTimeout(() => setWwOk(false), 3000);
  };

  const rdwOphalen = async () => {
    const ken = motorForm.kenteken.replace(/-/g, "").toUpperCase();
    if (!ken || ken.length < 4) { setRdwFout("Vul eerst een kenteken in."); return; }
    setRdwBezig(true); setRdwFout(null);
    try {
      const res = await fetch(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${ken}`);
      const data = await res.json();
      if (!data.length) { setRdwFout("Kenteken niet gevonden in RDW."); setRdwBezig(false); return; }
      const v = data[0];
      const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
      setMotorForm(p => ({
        ...p,
        merk: cap(v.merk) || p.merk,
        model: v.handelsbenaming || p.model,
        bouwjaar: v.datum_eerste_toelating ? v.datum_eerste_toelating.substring(0, 4) : p.bouwjaar,
      }));
    } catch { setRdwFout("Ophalen mislukt, vul handmatig in."); }
    setRdwBezig(false);
  };

  const voegMotorToe = async () => {
    if (!motorForm.merk || !motorForm.model || !motorForm.kenteken) { setMotorFout("Vul merk, model en kenteken in."); return; }
    setMotorBezig(true); setMotorFout(null);
    const err = await onVoegMotorToe(motorForm);
    setMotorBezig(false);
    if (err) { setMotorFout(err); return; }
    setMotorOk(true);
    setMotorForm(leegMotorForm);
    setToonMotorForm(false);
    setTimeout(() => setMotorOk(false), 2500);
  };

  const verwijderMotor = async (motorId) => {
    setVerwijderBezig(true); setVerwijderFout(null);
    const err = await onVerwijderMotor(motorId);
    setVerwijderBezig(false);
    if (err) { setVerwijderFout(err); return; }
    setVerwijderBevestigId(null);
  };

  const lbl = { fontSize: 12, color: T.muted, marginBottom: 4, display: "block" };
  const veld = { ...css.input, marginBottom: 10 };

  return (
    <div>
      {/* Profielgegevens */}
      <div style={css.card}>
        <div style={css.sectionTitle}>Mijn gegevens</div>
        <label style={lbl}>Naam</label>
        <input style={veld} type="text" autoComplete="name" value={profiel.naam}
          onChange={e => setProfiel(p => ({...p, naam: e.target.value}))} placeholder="Volledige naam" />
        <label style={lbl}>Telefoonnummer</label>
        <input style={veld} type="tel" autoComplete="tel" value={profiel.telefoon}
          onChange={e => setProfiel(p => ({...p, telefoon: e.target.value}))} placeholder="06-12345678" />
        <label style={lbl}>Adres</label>
        <input style={veld} type="text" autoComplete="street-address" value={profiel.adres}
          onChange={e => setProfiel(p => ({...p, adres: e.target.value}))} placeholder="Straat en huisnummer" />
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: "0 0 42%" }}>
            <label style={lbl}>Postcode</label>
            <input style={css.input} type="text" autoComplete="postal-code" value={profiel.postcode}
              onChange={e => setProfiel(p => ({...p, postcode: e.target.value}))} placeholder="1234 AB" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Woonplaats</label>
            <input style={css.input} type="text" autoComplete="address-level2" value={profiel.woonplaats}
              onChange={e => setProfiel(p => ({...p, woonplaats: e.target.value}))} placeholder="Tholen" />
          </div>
        </div>
        {profielFout && <div style={{ fontSize: 12, color: T.red, marginBottom: 10 }}>{profielFout}</div>}
        {profielOk ? (
          <div style={{ ...css.btn, background: T.green, textAlign: "center", padding: 13, borderRadius: 8, cursor: "default" }}>✓ Opgeslagen!</div>
        ) : (
          <button style={{ ...css.btn, opacity: profielBezig ? 0.5 : 1 }} onClick={slaProfielOp} disabled={profielBezig}>
            {profielBezig ? "Opslaan..." : "Wijzigingen opslaan"}
          </button>
        )}
      </div>

      {/* Wachtwoord */}
      <div style={css.card}>
        <div style={css.sectionTitle}>Wachtwoord wijzigen</div>
        <label style={lbl}>Nieuw wachtwoord</label>
        <input style={veld} type="password" autoComplete="new-password" value={ww.nieuw}
          onChange={e => setWw(p => ({...p, nieuw: e.target.value}))} placeholder="Minimaal 8 tekens" />
        <label style={lbl}>Herhaal nieuw wachtwoord</label>
        <input style={css.input} type="password" autoComplete="new-password" value={ww.herhaal}
          onChange={e => setWw(p => ({...p, herhaal: e.target.value}))} placeholder="Zelfde wachtwoord" />
        {wwFout && <div style={{ fontSize: 12, color: T.red, marginTop: 10 }}>{wwFout}</div>}
        {wwOk ? (
          <div style={{ ...css.btn, background: T.green, textAlign: "center", padding: 13, borderRadius: 8, marginTop: 12, cursor: "default" }}>✓ Wachtwoord gewijzigd!</div>
        ) : (
          <button style={{ ...css.btn, marginTop: 12, opacity: (!ww.nieuw || wwBezig) ? 0.5 : 1 }} onClick={wijzigWw} disabled={!ww.nieuw || wwBezig}>
            {wwBezig ? "Wijzigen..." : "Wachtwoord wijzigen"}
          </button>
        )}
      </div>

      {/* Motoren beheren */}
      <div style={css.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={css.sectionTitle} >Mijn motoren</div>
          <button onClick={() => { setToonMotorForm(v => !v); setMotorFout(null); setRdwFout(null); setMotorForm(leegMotorForm); }}
            style={{ background: toonMotorForm ? "transparent" : T.accentSoft, border: `1px solid ${toonMotorForm ? T.border : T.accent}40`, borderRadius: 6, padding: "6px 12px", color: toonMotorForm ? T.muted : T.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif" }}>
            {toonMotorForm ? "Annuleren" : "+ Toevoegen"}
          </button>
        </div>

        {motoren.length === 0 && !toonMotorForm && (
          <div style={{ fontSize: 13, color: T.muted, paddingBottom: 4 }}>Nog geen motoren gekoppeld</div>
        )}

        {motoren.map((m, i) => (
          <div key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: (i < motoren.length - 1 || toonMotorForm || verwijderBevestigId === m.id) ? `1px solid ${T.border}` : "none" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.merk} {m.model}</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{m.kenteken}{m.bouwjaar ? ` · ${m.bouwjaar}` : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={css.badge(T.accent)}>{m.kenteken}</span>
                <button onClick={() => { setVerwijderBevestigId(verwijderBevestigId === m.id ? null : m.id); setVerwijderFout(null); }}
                  style={{ background: "none", border: "none", color: verwijderBevestigId === m.id ? T.red : T.muted, fontSize: 16, cursor: "pointer", padding: "4px 2px", lineHeight: 1 }}
                  title="Motor verwijderen">🗑</button>
              </div>
            </div>
            {verwijderBevestigId === m.id && (
              <div style={{ background: `${T.red}12`, border: `1px solid ${T.red}35`, borderRadius: 6, padding: "10px 12px", margin: "6px 0 8px" }}>
                <div style={{ fontSize: 13, color: T.red, marginBottom: 8, fontWeight: 600 }}>
                  {m.merk} {m.model} verwijderen?
                </div>
                {verwijderFout && <div style={{ fontSize: 12, color: T.red, marginBottom: 8 }}>{verwijderFout}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => verwijderMotor(m.id)} disabled={verwijderBezig}
                    style={{ flex: 1, padding: "8px", background: T.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif", opacity: verwijderBezig ? 0.6 : 1 }}>
                    {verwijderBezig ? "Verwijderen..." : "Ja, verwijder"}
                  </button>
                  <button onClick={() => { setVerwijderBevestigId(null); setVerwijderFout(null); }}
                    style={{ flex: 1, padding: "8px", background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, cursor: "pointer", fontFamily: "Barlow, sans-serif" }}>
                    Annuleer
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {toonMotorForm && (
          <div style={{ paddingTop: 14 }}>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 10, lineHeight: 1.6 }}>
              Vul het kenteken in en druk op Ophalen om gegevens automatisch in te vullen.
            </div>

            {/* Kenteken + RDW ophalen */}
            <label style={lbl}>Kenteken</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ ...css.input, flex: 1 }} type="text" value={motorForm.kenteken}
                onChange={e => { setMotorForm(p => ({...p, kenteken: e.target.value.toUpperCase()})); setRdwFout(null); }}
                placeholder="AA-123-BB" />
              <button onClick={rdwOphalen} disabled={rdwBezig}
                style={{ flexShrink: 0, padding: "11px 14px", background: T.accentSoft, border: `1px solid ${T.accent}40`, borderRadius: 6, color: T.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif", opacity: rdwBezig ? 0.6 : 1, whiteSpace: "nowrap" }}>
                {rdwBezig ? "..." : "Ophalen ↗"}
              </button>
            </div>
            {rdwFout && <div style={{ fontSize: 12, color: T.yellow, marginBottom: 10 }}>{rdwFout}</div>}

            <label style={lbl}>Merk</label>
            <input style={veld} type="text" value={motorForm.merk}
              onChange={e => setMotorForm(p => ({...p, merk: e.target.value}))} placeholder="bijv. Honda" />

            <label style={lbl}>Model</label>
            <input style={veld} type="text" value={motorForm.model}
              onChange={e => setMotorForm(p => ({...p, model: e.target.value}))} placeholder="bijv. CBR 600 F" />

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Bouwjaar</label>
                <input style={css.input} type="number" value={motorForm.bouwjaar}
                  onChange={e => setMotorForm(p => ({...p, bouwjaar: e.target.value}))} placeholder="bijv. 2018" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>In bezit sinds</label>
                <input style={css.input} type="date" value={motorForm.aankoopdatum}
                  onChange={e => setMotorForm(p => ({...p, aankoopdatum: e.target.value}))} />
              </div>
            </div>

            <label style={lbl}>Kilometerstand bij aankoop</label>
            <input style={veld} type="number" value={motorForm.beginkm}
              onChange={e => setMotorForm(p => ({...p, beginkm: e.target.value}))} placeholder="bijv. 12500" />

            {motorFout && <div style={{ fontSize: 12, color: T.red, marginBottom: 10 }}>{motorFout}</div>}
            {motorOk ? (
              <div style={{ ...css.btn, background: T.green, textAlign: "center", padding: 13, borderRadius: 8, cursor: "default" }}>✓ Motor toegevoegd!</div>
            ) : (
              <button style={{ ...css.btn, opacity: (!motorForm.merk || !motorForm.model || !motorForm.kenteken || motorBezig) ? 0.5 : 1 }} onClick={voegMotorToe} disabled={motorBezig}>
                {motorBezig ? "Toevoegen..." : "Motor toevoegen"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Uitloggen */}
      <button onClick={() => import("../lib/supabase.js").then(m => m.uitloggen())}
        style={{ ...css.btnGhost, marginTop: 4 }}>
        Uitloggen
      </button>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function KlantApp({ userId }) {
  const [tab, setTab] = useState("motor");
  const [klant, setKlant] = useState(null);
  const [motoren, setMotoren] = useState([]);
  const [bezetteDagen, setBezetteDagen] = useState([]);
  const [geslotenDagen, setGeslotenDagen] = useState([]);
  const [openingstijden, setOpeningstijden] = useState(null);
  const [opmerking, setOpmerking] = useState("");
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLaden(false), 12000);
    const laadData = async () => {
      try {
        const sb = (await import("../lib/supabase.js")).supabase;

        const { data: klantData } = await sb
          .from("klanten").select("*").eq("user_id", userId).single();
        if (!klantData) { setLaden(false); clearTimeout(timer); return; }
        setKlant(klantData);

        const { data: motorenData } = await sb
          .from("motoren").select("*").eq("klant_id", klantData.id);
        const motorIds = (motorenData||[]).map(m => m.id);

        if (motorIds.length > 0) {
          const [{ data: kmData }, { data: svcData }] = await Promise.all([
            sb.from("km_historie").select("*").in("motor_id", motorIds).order("datum"),
            sb.from("service_beurten").select("*").in("motor_id", motorIds).order("datum", { ascending: false }),
          ]);
          setMotoren((motorenData||[]).map(m => ({
            ...m,
            kmHistory: (kmData||[]).filter(k => k.motor_id === m.id).map(k => ({ datum: k.datum, km: k.km })),
            service: (svcData||[]).filter(s => s.motor_id === m.id),
          })));
        } else {
          setMotoren([]);
        }

        const [{ data: afspraken }, { data: inst }] = await Promise.all([
          sb.from("afspraken").select("datum").gte("datum", TODAY),
          sb.from("instellingen").select("gesloten_dagen,openingstijden,opmerking").single(),
        ]);
        const gesloten = inst?.gesloten_dagen || [];
        setGeslotenDagen(gesloten);
        setBezetteDagen([...(afspraken||[]).map(a => a.datum), ...gesloten]);
        if (inst?.openingstijden) setOpeningstijden(inst.openingstijden);
        if (inst?.opmerking !== undefined) setOpmerking(inst.opmerking || "");

      } catch(e) { console.error(e); }
      setLaden(false);
      clearTimeout(timer);
    };
    laadData();
    return () => clearTimeout(timer);
  }, [userId]);

  const slaKmOp = async (motorId, km) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const { error } = await sb.from("km_historie").insert({ motor_id: motorId, km, datum: TODAY });
    if (error) { console.error("Km opslaan mislukt:", error); return; }
    setMotoren(prev => prev.map(m => m.id === motorId
      ? { ...m, kmHistory: [...m.kmHistory, { datum: TODAY, km }] } : m
    ));
  };

  const slaAfspraakOp = async (f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const motor = motoren.find(m => m.id === f.motorId);
    await sb.from("afspraken").insert({
      klant_id: klant.id, motor_id: motor?.id || null,
      datum: f.datum, opmerking: f.opmerking || "", status: "aangevraagd",
    });
    setBezetteDagen(prev => [...prev, f.datum]);
  };

  const updateKlantProfiel = async (data) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const { error } = await sb.from("klanten").update(data).eq("id", klant.id);
    if (error) return error.message;
    setKlant(prev => ({ ...prev, ...data }));
    return null;
  };

  const wijzigWachtwoord = async (nieuwWachtwoord) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const { error } = await sb.auth.updateUser({ password: nieuwWachtwoord });
    if (error) return error.message;
    return null;
  };

  const voegMotorToeVanKlant = async (data) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const { data: nieuw, error } = await sb.from("motoren").insert({
      klant_id: klant.id,
      merk: data.merk,
      model: data.model,
      kenteken: data.kenteken,
      bouwjaar: data.bouwjaar ? parseInt(data.bouwjaar) : null,
      aankoopdatum: data.aankoopdatum || null,
    }).select().single();
    if (error) return error.message;
    if (nieuw && data.beginkm && parseInt(data.beginkm) > 0) {
      await sb.from("km_historie").insert({
        motor_id: nieuw.id,
        km: parseInt(data.beginkm),
        datum: data.aankoopdatum || TODAY,
      });
    }
    const beginkm = data.beginkm ? parseInt(data.beginkm) : 0;
    setMotoren(prev => [...prev, {
      ...nieuw,
      kmHistory: beginkm > 0 ? [{ datum: data.aankoopdatum || TODAY, km: beginkm }] : [],
      service: [],
    }]);
    return null;
  };

  const verwijderMotor = async (motorId) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    // km_historie verwijderen (klant mag dit)
    await sb.from("km_historie").delete().eq("motor_id", motorId);
    const { error } = await sb.from("motoren").delete().eq("id", motorId);
    if (error) return "Verwijderen mislukt. Neem contact op met De Jonge Motoren als de motor servicehistorie heeft.";
    setMotoren(prev => prev.filter(m => m.id !== motorId));
    return null;
  };

  const nav = [
    { id: "motor", icon: "🏍", label: "Motor" },
    { id: "service", icon: "🔧", label: "Service" },
    { id: "km", icon: "📍", label: "Km Stand" },
    { id: "afspraak", icon: "📅", label: "Afspraak" },
    { id: "contact", icon: "📞", label: "Contact" },
  ];
  const titles = { motor: "Mijn Motor", service: "Servicegeschiedenis", km: "Km Stand", afspraak: "Afspraak", contact: "Contact", instellingen: "Instellingen" };

  if (laden) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", background:T.bg }}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
        <div style={{ width:28, height:28, border:`3px solid ${T.accent}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
        <div style={{ color:T.muted, fontSize:13, fontFamily:"Barlow, sans-serif" }}>Laden...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!klant) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", background:T.bg, fontFamily:"Barlow, sans-serif", padding:24, textAlign:"center" }}>
      <div>
        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:900, fontSize:22, letterSpacing:2, color:T.text }}>DE JONGE MOTOREN</div>
        <div style={{ fontSize:13, color:T.muted, marginTop:16, lineHeight:1.8 }}>
          Je account is nog niet gekoppeld aan een klantprofiel.<br/>Neem contact op met De Jonge Motoren.
        </div>
        <a href="https://wa.me/31140000000" style={{ display:"inline-block", marginTop:20, padding:"11px 20px", background:T.accent, color:"#fff", borderRadius:8, textDecoration:"none", fontSize:14, fontWeight:600 }}>
          Stuur een bericht →
        </a>
      </div>
    </div>
  );

  if (klant.status === 'in_afwachting') return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", background:T.bg, fontFamily:"Barlow, sans-serif", padding:24, textAlign:"center" }}>
      <div>
        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:900, fontSize:22, letterSpacing:2, color:T.text }}>DE JONGE MOTOREN</div>
        <div style={{ fontSize:36, margin:"20px 0 12px" }}>⏳</div>
        <div style={{ fontSize:16, fontWeight:600, color:T.text, marginBottom:10 }}>Account wordt beoordeeld</div>
        <div style={{ fontSize:13, color:T.muted, lineHeight:1.8, maxWidth:280, margin:"0 auto" }}>
          Je aanmelding is ontvangen. De Jonge Motoren geeft je zo snel mogelijk toegang.
        </div>
        <button onClick={() => import("../lib/supabase.js").then(m => m.uitloggen())}
          style={{ marginTop:24, padding:"10px 20px", background:"transparent", border:`1px solid ${T.border}`, color:T.muted, borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"Barlow, sans-serif" }}>
          Uitloggen
        </button>
      </div>
    </div>
  );

  if (klant.status === 'afgewezen') return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", background:T.bg, fontFamily:"Barlow, sans-serif", padding:24, textAlign:"center" }}>
      <div>
        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:900, fontSize:22, letterSpacing:2, color:T.text }}>DE JONGE MOTOREN</div>
        <div style={{ fontSize:36, margin:"20px 0 12px" }}>❌</div>
        <div style={{ fontSize:13, color:T.muted, lineHeight:1.8, maxWidth:280, margin:"0 auto" }}>
          Je aanmelding is niet goedgekeurd. Neem contact op als je denkt dat dit een fout is.
        </div>
        <a href="https://wa.me/31140000000" style={{ display:"inline-block", marginTop:20, padding:"11px 20px", background:T.accent, color:"#fff", borderRadius:8, textDecoration:"none", fontSize:14, fontWeight:600 }}>
          Stuur een bericht →
        </a>
      </div>
    </div>
  );

  return (
    <div style={css.app}>
      {/* Top bar */}
      <div style={css.topBar}>
        <div style={css.logoWrap}>
          <div style={css.logoTop}>DE JONGE MOTOREN</div>
          <div style={css.logoSub}>MIJN GARAGE</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{klant.naam?.split(" ")[0] || klant.naam}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{motoren.length} motor{motoren.length !== 1 ? "en" : ""}</div>
          </div>
          {/* Instellingen knop */}
          <button onClick={() => setTab(tab === "instellingen" ? "motor" : "instellingen")}
            style={{ background: tab === "instellingen" ? T.accentSoft : "transparent", border: `1px solid ${tab === "instellingen" ? T.accent + "50" : T.border}`, borderRadius: 8, padding: "7px 9px", color: tab === "instellingen" ? T.accent : T.muted, fontSize: 17, cursor: "pointer", lineHeight: 1, marginLeft: 4 }}
            title="Instellingen">
            ⚙
          </button>
        </div>
      </div>

      {/* Pagina titel */}
      <div style={{ padding: "14px 20px 0" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: 0.5 }}>
          {titles[tab] || titles.motor}
        </div>
      </div>

      {/* Inhoud */}
      <div style={css.scroll}>
        {tab === "motor" && <MijnMotor motoren={motoren} />}
        {tab === "service" && <Servicegeschiedenis motoren={motoren} />}
        {tab === "km" && <KmStand motoren={motoren} onSlaOp={slaKmOp} />}
        {tab === "afspraak" && <Afspraak motoren={motoren} bezetteDagen={bezetteDagen} onSlaOp={slaAfspraakOp} />}
        {tab === "contact" && <Contact openingstijden={openingstijden} geslotenDagen={geslotenDagen} opmerking={opmerking} />}
        {tab === "instellingen" && (
          <Instellingen
            klant={klant}
            motoren={motoren}
            onUpdateKlant={updateKlantProfiel}
            onVoegMotorToe={voegMotorToeVanKlant}
            onVerwijderMotor={verwijderMotor}
            onWijzigWachtwoord={wijzigWachtwoord}
          />
        )}
      </div>

      {/* Bottom nav (5 tabs, instellingen via tandwiel) */}
      <nav style={css.bottomNav}>
        {nav.map(n => (
          <button key={n.id} style={css.navBtn(tab === n.id)} onClick={() => setTab(n.id)}>
            <span style={{ fontSize: 20 }}>{n.icon}</span>
            <span style={{ fontSize: 9, letterSpacing: 0.3, fontWeight: tab === n.id ? 600 : 400 }}>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
