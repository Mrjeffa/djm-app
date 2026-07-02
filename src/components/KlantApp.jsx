import { useState, useEffect } from "react";
import { supabase, uitloggen } from "../lib/supabase.js";

const useIsMobile = () => {
  const [mob, setMob] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMob(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mob;
};

// ── Theme ──────────────────────────────────────────────────────────────────
const T_LIGHT = {
  bg: "#F8F8F8", surf: "#FFFFFF", surf2: "#F2F2F2", surf3: "#EBEBEB",
  border: "#E0E0E0", accent: "#E31E24", accentSoft: "#E31E2418",
  text: "#1A1A1A", muted: "#767676", green: "#16A34A", yellow: "#D97706", red: "#DC2626",
};
const T_DARK = {
  bg: "#111111", surf: "#1C1C1E", surf2: "#2C2C2E", surf3: "#3A3A3C",
  border: "#38383A", accent: "#E31E24", accentSoft: "#E31E2425",
  text: "#F2F2F7", muted: "#8E8E93", green: "#30D158", yellow: "#FFD60A", red: "#FF453A",
};
let T = {...T_LIGHT};

// ── Utils ──────────────────────────────────────────────────────────────────
const TODAY = new Date().toISOString().split("T")[0];
const DAGEN_NL = ["zo","ma","di","wo","do","vr","za"];
const MAANDEN_NL = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

const fmtDatum = d => {
  const dt = new Date(d);
  return `${dt.getDate()} ${MAANDEN_NL[dt.getMonth()]} ${dt.getFullYear()}`;
};

const bandLeeftijdJaren = (datum) => {
  if (!datum) return null;
  const match = datum.match(/(\d{2})(\d{4})/);
  if (!match) return null;
  const week = parseInt(match[1]);
  const year = parseInt(match[2]);
  const productie = new Date(year, 0, 1 + (week - 1) * 7);
  const leeftijd = (new Date() - productie) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(leeftijd * 10) / 10;
};
const BandAgeLabel = ({ datum }) => {
  const jaren = bandLeeftijdJaren(datum);
  if (!jaren) return <span style={{ fontSize:12, color:T.muted }}>{datum}</span>;
  const kleur = jaren > 6 ? T.red : jaren > 4 ? T.yellow : T.green;
  return <span style={{ fontSize:12, color:kleur, fontWeight:600 }}>{jaren.toFixed(1)} jaar ({datum})</span>;
};

const getBeschikbareDagen = (bezet = [], geslotenDagen = [], openingstijden = null) => {
  const DAGMAP_KL = ["zo","ma","di","wo","do","vr","za"];
  const isOpen = (dayOfWeek) => {
    if (openingstijden) return openingstijden[DAGMAP_KL[dayOfWeek]]?.gesloten !== true;
    return [3,4,5].includes(dayOfWeek); // Fallback: wo/do/vr
  };
  const dagen = [];
  const start = new Date(TODAY);
  start.setDate(start.getDate() + 1);
  for (let i = 0; i <= 60; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dayOfWeek = d.getDay();
    if (!isOpen(dayOfWeek)) continue;
    const iso = d.toISOString().split("T")[0];
    if (geslotenDagen.includes(iso)) continue;
    dagen.push({ datum: iso, bezet: bezet.includes(iso), dag: DAGEN_NL[dayOfWeek] });
  }
  return dagen;
};

// ── Icons ──────────────────────────────────────────────────────────────────
const GearIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ── Shared UI ──────────────────────────────────────────────────────────────
const css = {
  get app() { return { maxWidth: 430, margin: "0 auto", minHeight: "100dvh", background: T.bg, fontFamily: "Barlow, sans-serif", color: T.text, display: "flex", flexDirection: "column", position: "relative" }; },
  get topBar() { return { padding: "14px 16px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }; },
  logoWrap: { display: "flex", flexDirection: "column" },
  get logoTop() { return { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 17, letterSpacing: 2, color: T.text, lineHeight: 1 }; },
  logoSub: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: 3, color: "#E31E24", marginTop: 2 },
  scroll: { flex: 1, overflowY: "auto", padding: "20px 20px 90px" },
  get bottomNav() { return { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: T.surf, borderTop: `1px solid ${T.border}`, display: "flex", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom)" }; },
  navBtn: (a) => ({ flex: 1, padding: "10px 4px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", background: "none", border: "none", color: a ? T.accent : T.muted, fontFamily: "Barlow, sans-serif" }),
  get card() { return { background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }; },
  get cardAccent() { return { background: T.surf, border: `1px solid ${T.accent}40`, borderRadius: 10, padding: 16, marginBottom: 12 }; },
  get sectionTitle() { return { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 2, color: T.muted, textTransform: "uppercase", marginBottom: 12 }; },
  bigNum: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 38, color: "#E31E24", lineHeight: 1 },
  motorTitle: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 24, lineHeight: 1 },
  badge: (c) => ({ display: "inline-block", padding: "3px 9px", borderRadius: 3, fontSize: 11, fontWeight: 700, background: `${c}22`, color: c, letterSpacing: 0.5 }),
  get input() { return { background: T.surf2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "11px 14px", color: T.text, fontSize: 16, fontFamily: "Barlow, sans-serif", outline: "none", width: "100%", boxSizing: "border-box" }; },
  btn: { width: "100%", padding: "13px", background: "#E31E24", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif" },
  get btnGhost() { return { width: "100%", padding: "13px", background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 15, cursor: "pointer", fontFamily: "Barlow, sans-serif" }; },
};

// ── Motor dropdown selector ────────────────────────────────────────────────
function MotorSelector({ motoren, selected, onSelect }) {
  if (motoren.length <= 1) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>
        Geselecteerd voertuig
      </div>
      <div style={{ position: "relative" }}>
        <select value={selected} onChange={e => onSelect(e.target.value)}
          style={{ width: "100%", background: T.surf2, border: `1px solid ${T.accent}50`, borderRadius: 8, padding: "11px 40px 11px 14px", color: T.text, fontSize: 15, fontFamily: "Barlow, sans-serif", fontWeight: 600, outline: "none", appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}>
          {motoren.map(m => (
            <option key={m.id} value={m.id} style={{ background: "#FFFFFF" }}>
              {m.merk} {m.model} · {m.kenteken}
            </option>
          ))}
        </select>
        <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: T.accent, fontSize: 11 }}>▼</div>
      </div>
    </div>
  );
}

// ── Scherm: Mijn Motor ─────────────────────────────────────────────────────
function MijnMotor({ motoren, selMotorId, onSelMotor, onVoegServiceToe, onNaarInstellingen }) {
  const motor = motoren.find(m => m.id === selMotorId) || motoren[0];
  const [eigenOpen, setEigenOpen] = useState(false);
  const [eigenF, setEigenF] = useState({ datum: TODAY, omschrijving: "", km: "", interval_gereset: false });
  const [eigenBezig, setEigenBezig] = useState(false);
  const [eigenOk, setEigenOk] = useState(false);
  const [eigenFout, setEigenFout] = useState(null);

  if (!motor) return (
    <div style={{ textAlign:"center", marginTop:60, padding:"0 24px" }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🏍</div>
      <div style={{ fontSize:16, fontWeight:600, color:T.text, marginBottom:8 }}>Nog geen motor toegevoegd</div>
      <div style={{ fontSize:14, color:T.muted, lineHeight:1.6, marginBottom:24 }}>
        Voeg je motor toe om het onderhoudsoverzicht, km-stand en bandinfo bij te houden.
      </div>
      {onNaarInstellingen && (
        <button onClick={onNaarInstellingen}
          style={{ background:T.accent, color:"#fff", border:"none", borderRadius:8, padding:"13px 28px", fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"Barlow, sans-serif" }}>
          Motor toevoegen →
        </button>
      )}
    </div>
  );

  const huidigKm = motor.kmHistory.length ? motor.kmHistory[motor.kmHistory.length - 1].km : 0;
  const lastServiceKm = motor.last_service_km || 0;
  const intervalKm = motor.interval_km || 5000;
  const kmSindsBeurt = (lastServiceKm > 0 && motor.service?.length > 0) ? huidigKm - lastServiceKm : null;
  const intervalPct = kmSindsBeurt !== null ? Math.min(100, Math.round(kmSindsBeurt / intervalKm * 100)) : null;
  const statusColor = intervalPct === null ? T.muted : intervalPct >= 90 ? T.red : intervalPct >= 70 ? T.yellow : T.green;

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selMotorId} onSelect={onSelMotor} />

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
      {(motor.voorband_maat || motor.voorband_datum || motor.achterband_maat || motor.achterband_datum) && (
        <div style={css.card}>
          <div style={css.sectionTitle}>Banden</div>
          {(motor.voorband_maat || motor.voorband_datum) && (
            <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ fontSize:13, color:T.muted }}>Voorband</div>
              <div style={{ fontSize:13, fontWeight:600 }}>
                {motor.voorband_maat && <span style={{ marginRight:8 }}>{motor.voorband_maat}</span>}
                {motor.voorband_datum && <BandAgeLabel datum={motor.voorband_datum}/>}
              </div>
            </div>
          )}
          {(motor.achterband_maat || motor.achterband_datum) && (
            <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0" }}>
              <div style={{ fontSize:13, color:T.muted }}>Achterband</div>
              <div style={{ fontSize:13, fontWeight:600 }}>
                {motor.achterband_maat && <span style={{ marginRight:8 }}>{motor.achterband_maat}</span>}
                {motor.achterband_datum && <BandAgeLabel datum={motor.achterband_datum}/>}
              </div>
            </div>
          )}
        </div>
      )}
      {motor.bijzonderheden && (
        <div style={css.card}>
          <div style={css.sectionTitle}>Bijzonderheden</div>
          <div style={{ fontSize:14, color:T.text, lineHeight:1.7 }}>{motor.bijzonderheden}</div>
        </div>
      )}
      <div style={{ marginTop:8 }}>
        {!eigenOpen ? (
          <button onClick={() => { setEigenOpen(true); setEigenF({ datum:TODAY, omschrijving:"", km:"", interval_gereset:false }); setEigenFout(null); setEigenOk(false); }}
            style={{ background:"none", border:`1px solid ${T.border}`, borderRadius:6, padding:"8px 16px", fontSize:13, color:T.muted, cursor:"pointer", fontFamily:"Barlow, sans-serif", width:"100%" }}>
            + Overige werkzaamheden invoeren
          </button>
        ) : (
          <div style={css.card}>
            <div style={css.sectionTitle}>Overige werkzaamheden invoeren</div>
            <div style={{ fontSize:12, color:T.muted, marginBottom:12, lineHeight:1.6 }}>
              Zelf olie ververst, of ergens anders iets laten doen? Voer het hier in zodat je servicehistorie compleet blijft.
            </div>
            <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Datum</label>
            <input type="date" style={{ ...css.input, marginBottom:10 }} value={eigenF.datum} onChange={e=>setEigenF(p=>({...p,datum:e.target.value}))}/>
            <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Omschrijving</label>
            <textarea style={{ ...css.input, height:70, resize:"none", marginBottom:10 }} value={eigenF.omschrijving} onChange={e=>setEigenF(p=>({...p,omschrijving:e.target.value}))} placeholder="bijv. Olie en filter vervangen, rem vloeistof bijgevuld..."/>
            <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Kilometerstand</label>
            <input type="number" style={{ ...css.input, marginBottom:12 }} value={eigenF.km} onChange={e=>setEigenF(p=>({...p,km:e.target.value}))} placeholder="bijv. 23500"/>
            <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, cursor:"pointer", fontSize:13, color:T.text }}>
              <input type="checkbox" checked={eigenF.interval_gereset} onChange={e=>setEigenF(p=>({...p,interval_gereset:e.target.checked}))} style={{ width:16, height:16, accentColor:T.accent, cursor:"pointer" }}/>
              Onderhoudsinterval resetten
            </label>
            {eigenF.interval_gereset && (
              <div style={{ background:`${T.green}12`, border:`1px solid ${T.green}40`, borderRadius:6, padding:"8px 12px", marginBottom:12, fontSize:12, color:T.green, lineHeight:1.5 }}>
                Het onderhoudsinterval wordt gereset op basis van de ingevulde kilometerstand. Dit wordt geregistreerd in de servicehistorie.
              </div>
            )}
            {eigenFout && <div style={{ fontSize:12, color:T.red, marginBottom:10 }}>{eigenFout}</div>}
            {eigenOk && <div style={{ fontSize:12, color:T.green, marginBottom:10, fontWeight:600 }}>✓ Werkzaamheden opgeslagen!</div>}
            <div style={{ display:"flex", gap:8 }}>
              <button style={{ ...css.btn, flex:1, opacity:eigenBezig?0.5:1 }} disabled={eigenBezig} onClick={async()=>{
                if (!eigenF.omschrijving.trim()) { setEigenFout("Voer een omschrijving in."); return; }
                setEigenBezig(true); setEigenFout(null);
                const err = await onVoegServiceToe(motor.id, eigenF);
                setEigenBezig(false);
                if (err) { setEigenFout(err); return; }
                setEigenOk(true);
                setEigenF({ datum:TODAY, omschrijving:"", km:"" });
                setTimeout(() => { setEigenOk(false); setEigenOpen(false); }, 2000);
              }}>
                {eigenBezig ? "Opslaan..." : "Opslaan"}
              </button>
              <button style={{ ...css.btnGhost }} onClick={() => setEigenOpen(false)}>Annuleer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scherm: Servicegeschiedenis ────────────────────────────────────────────
function Servicegeschiedenis({ motoren, selMotorId, onSelMotor, actieKnop = null, onWijzigService = null }) {
  const motor = motoren.find(m => m.id === selMotorId) || motoren[0];
  const [editSvcId, setEditSvcId] = useState(null);
  const [editF, setEditF] = useState({ datum:"", omschrijving:"", km:"", interval_gereset:false });
  const [editBezig, setEditBezig] = useState(false);
  const [editFout, setEditFout] = useState(null);

  if (!motor) return null;

  const lbl = { fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 };

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selMotorId} onSelect={id => { onSelMotor(id); setEditSvcId(null); }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>
          {motor.merk} {motor.model}
          <span style={{ ...css.badge(T.accent), marginLeft: 10, fontSize: 10 }}>{motor.kenteken}</span>
        </div>
        {actieKnop}
      </div>
      {motor.service.length === 0 ? (
        <div style={css.card}>
          <div style={{ color: T.muted, fontSize: 14, textAlign: "center", padding: "20px 0" }}>Nog geen servicebeurten geregistreerd</div>
        </div>
      ) : (
        motor.service.slice().reverse().map((sv, i) => (
          <div key={sv.id || i} style={{ display: "flex", gap: 14, marginBottom: 4 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: sv.klant_invoer ? T.muted : T.accent, marginTop: 4, flexShrink: 0 }} />
              {i < motor.service.length - 1 && <div style={{ width: 1, flex: 1, background: T.border, minHeight: 20, marginTop: 4 }} />}
            </div>
            <div style={{ ...css.card, flex: 1, marginBottom: i < motor.service.length - 1 ? 0 : 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: sv.klant_invoer ? T.muted : T.accent, fontWeight: 600 }}>{sv.datum}</div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  {sv.km && <div style={{ fontSize: 11, color: T.muted }}>{sv.km.toLocaleString()} km</div>}
                  {sv.klant_invoer && onWijzigService && editSvcId !== sv.id && (
                    <button onClick={() => { setEditSvcId(sv.id); setEditF({ datum:sv.datum, omschrijving:sv.omschrijving||"", km:sv.km||"", interval_gereset:sv.interval_gereset||false }); setEditFout(null); }}
                      style={{ background:"none", border:"none", color:T.muted, fontSize:12, cursor:"pointer", padding:"0 2px", lineHeight:1 }}>✏</button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>{sv.omschrijving}</div>
              {sv.interval_gereset && <div style={{ fontSize:11, color:T.green, marginTop:5, fontWeight:600 }}>✓ Onderhoudsinterval gereset</div>}
              {sv.klant_invoer && <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>Ingevoerd door klant</div>}

              {editSvcId === sv.id && (
                <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
                  <label style={lbl}>Datum</label>
                  <input type="date" style={{ ...css.input, marginBottom:10 }} value={editF.datum} onChange={e=>setEditF(p=>({...p,datum:e.target.value}))}/>
                  <label style={lbl}>Omschrijving</label>
                  <textarea style={{ ...css.input, height:64, resize:"none", marginBottom:10 }} value={editF.omschrijving} onChange={e=>setEditF(p=>({...p,omschrijving:e.target.value}))} placeholder="Omschrijving..."/>
                  <label style={lbl}>Kilometerstand</label>
                  <input type="number" style={{ ...css.input, marginBottom:10 }} value={editF.km} onChange={e=>setEditF(p=>({...p,km:e.target.value}))} placeholder="bijv. 23500"/>
                  <label style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, cursor:"pointer", fontSize:13, color:T.text }}>
                    <input type="checkbox" checked={editF.interval_gereset} onChange={e=>setEditF(p=>({...p,interval_gereset:e.target.checked}))} style={{ width:16, height:16, accentColor:T.accent, cursor:"pointer" }}/>
                    Onderhoudsinterval resetten
                  </label>
                  {editFout && <div style={{ fontSize:12, color:T.red, marginBottom:8 }}>{editFout}</div>}
                  <div style={{ display:"flex", gap:8 }}>
                    <button style={{ ...css.btn, flex:1, opacity:editBezig?0.5:1 }} disabled={editBezig} onClick={async()=>{
                      if (!editF.omschrijving.trim()) { setEditFout("Voer een omschrijving in."); return; }
                      setEditBezig(true); setEditFout(null);
                      const err = await onWijzigService(motor.id, sv.id, editF);
                      setEditBezig(false);
                      if (err) { setEditFout(err); return; }
                      setEditSvcId(null);
                    }}>
                      {editBezig ? "Opslaan..." : "Opslaan"}
                    </button>
                    <button style={{ ...css.btnGhost }} onClick={() => setEditSvcId(null)}>Annuleer</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Scherm: Km Stand ───────────────────────────────────────────────────────
function KmStand({ motoren, selMotorId, onSelMotor, onSlaOp }) {
  const [nieuwKm, setNieuwKm] = useState("");
  const [opgeslagen, setOpgeslagen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const motor = motoren.find(m => m.id === selMotorId) || motoren[0];
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
      <MotorSelector motoren={motoren} selected={selMotorId} onSelect={id => { onSelMotor(id); setOpgeslagen(false); }} />

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
        {motor.kmHistory.slice().reverse().map((entry, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: i < motor.kmHistory.length - 1 ? `1px solid ${T.border}` : "none", alignItems: "center" }}>
            <div style={{ fontSize: 13, color: T.muted }}>{entry.datum}</div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 16 }}>{entry.km.toLocaleString()} km</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scherm: Afspraak ───────────────────────────────────────────────────────
const K_SOORT_DUUR = {
  "Kleine beurt":2,"Grote beurt":3,"Jaarlijkse inspectie":1,"Olie- en filterwissel":1,"Cardan olie verversen":1,"Winterklaar maken":1,
  "Voorband vervangen":1,"Achterband vervangen":1,"Beide banden vervangen":2,"Ketting en tandwielen vervangen":2,"Vering aanpassen of vervangen":2,
  "Remmen vervangen/controleren":1,"Remvloeistof vervangen":1,
  "Diagnose bij storingen":1,"Elektrische problemen oplossen":2,"Accu vervangen":1,
  "Aankoopkeuring":1,"Rijklaar maken":2,"Accessoires monteren":1,"Motor afstellen of synchroniseren":2,"Anders":1,
};
const K_SOORT_GROEPEN = [
  {label:"Onderhoud",items:["Kleine beurt","Grote beurt","Jaarlijkse inspectie","Olie- en filterwissel","Cardan olie verversen","Winterklaar maken"]},
  {label:"Banden & Aandrijving",items:["Voorband vervangen","Achterband vervangen","Beide banden vervangen","Ketting en tandwielen vervangen","Vering aanpassen of vervangen"]},
  {label:"Remmen & Hydraulica",items:["Remmen vervangen/controleren","Remvloeistof vervangen"]},
  {label:"Elektrisch & Diagnose",items:["Diagnose bij storingen","Elektrische problemen oplossen","Accu vervangen"]},
  {label:"Keuring & Overig",items:["Aankoopkeuring","Rijklaar maken","Accessoires monteren","Motor afstellen of synchroniseren","Anders"]},
];

function Afspraak({ motoren, selMotorId, onSelMotor, bezetteDagen = [], geslotenDagen = [], openingstijden = null, onSlaOp, afspraakSoorten = [] }) {
  const [soorten, setSoorten] = useState(new Set());
  const [openGroepen, setOpenGroepen] = useState(new Set());
  const [selDatum, setSelDatum] = useState(null);
  const [notitie, setNotitie] = useState("");
  const [verstuurd, setVerstuurd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const motor = motoren.find(m => m.id === selMotorId) || motoren[0];
  const dynamischeGroepen = (afspraakSoorten.length ? afspraakSoorten : K_SOORT_GROEPEN.map(g => ({...g, items: g.items.map(naam => ({naam, duur: K_SOORT_DUUR[naam] || 1}))}))).filter(g => !g.intern);
  const duurMap = Object.fromEntries(dynamischeGroepen.flatMap(g => (g.items || []).map(i => [i.naam, i.duur || 1])));
  const totaalUur = Math.min([...soorten].reduce((s, o) => s + (duurMap[o] || 1), 0), 8);

  const toggleSoort = (opt) => setSoorten(prev => { const n = new Set(prev); n.has(opt) ? n.delete(opt) : n.add(opt); return n; });
  const toggleGroep = (lbl) => setOpenGroepen(prev => { const n = new Set(prev); n.has(lbl) ? n.delete(lbl) : n.add(lbl); return n; });

  const verstuur = async () => {
    if (!selDatum || soorten.size === 0 || bezig) return;
    setBezig(true);
    await onSlaOp({ motorId: selMotorId || motor?.id, datum: selDatum, soort: [...soorten].join(", "), duur: totaalUur, opmerking: notitie });
    setBezig(false);
    setVerstuurd(true);
  };

  if (verstuurd) {
    return (
      <div style={{ textAlign: "center", paddingTop: 40 }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 8 }}>Aanvraag verstuurd!</div>
        <div style={{ fontSize: 14, color: T.muted, lineHeight: 1.8, maxWidth: 280, margin: "0 auto" }}>We nemen contact met je op om de afspraak te bevestigen.</div>
        <div style={{ ...css.card, marginTop: 24, textAlign: "left" }}>
          <div style={{ fontSize: 12, color: T.accent, marginBottom: 4 }}>Gevraagde datum</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{fmtDatum(selDatum)}</div>
          {motor && <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{motor.merk} {motor.model} · {motor.kenteken}</div>}
          <div style={{ fontSize: 13, color: T.text, marginTop: 8, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>{[...soorten].join(", ")}</div>
          {notitie && <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{notitie}</div>}
        </div>
        <button style={{ ...css.btnGhost, marginTop: 12 }} onClick={() => { setVerstuurd(false); setSelDatum(null); setNotitie(""); setSoorten(new Set()); }}>Nieuwe aanvraag</button>
      </div>
    );
  }

  return (
    <div>
      <MotorSelector motoren={motoren} selected={selMotorId} onSelect={onSelMotor} />
      <div style={{ ...css.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Wat moet er gebeuren?</div>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 10, fontStyle: "italic" }}>Tijden zijn schattingen en kunnen in werkelijkheid afwijken.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {dynamischeGroepen.map(g => {
            const open = openGroepen.has(g.label);
            const geselecteerd = (g.items || []).filter(item => soorten.has(item.naam));
            const heeftSel = geselecteerd.length > 0;
            return (
              <div key={g.label} style={{ border: `1px solid ${heeftSel ? T.accent : T.border}`, borderRadius: 6, overflow: "hidden" }}>
                <button onClick={() => toggleGroep(g.label)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: heeftSel ? T.accentSoft : T.surf2, border: "none", cursor: "pointer", fontFamily: "Barlow, sans-serif", textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: heeftSel ? 600 : 400, color: heeftSel ? T.accent : T.text }}>{g.label}</span>
                    {heeftSel && <span style={{ ...css.badge(T.accent), fontSize: 10 }}>{geselecteerd.length}</span>}
                  </div>
                  <span style={{ fontSize: 11, color: T.muted }}>{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 5, borderTop: `1px solid ${T.border}`, background: T.surf }}>
                    {(g.items || []).map(item => {
                      const sel = soorten.has(item.naam);
                      return (
                        <button key={item.naam} onClick={() => toggleSoort(item.naam)}
                          style={{ padding: "6px 12px", borderRadius: 4, border: `1px solid ${sel ? T.accent : T.border}`, background: sel ? T.accentSoft : "transparent", color: sel ? T.accent : T.text, cursor: "pointer", fontSize: 12, fontFamily: "Barlow, sans-serif", fontWeight: sel ? 600 : 400 }}>
                          {item.naam}{item.duur > 1 ? ` · ${item.duur}u` : " · 1u"}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {soorten.size > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: T.accent, fontWeight: 600, padding: "8px 10px", background: T.accentSoft, borderRadius: 4 }}>
            Geschatte totale duur: {totaalUur}u
            <span style={{ fontWeight: 400, color: T.muted }}> (max. 8u per dag)</span>
          </div>
        )}
      </div>
      <div style={{ ...css.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Kies een dag</div>
        <DatumKiezer bezetteDagen={bezetteDagen} geslotenDagen={geslotenDagen} openingstijden={openingstijden} value={selDatum || ""} onChange={setSelDatum} />
      </div>
      <div style={css.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Opmerkingen <span style={{ fontWeight: 400, color: T.muted }}>(optioneel)</span></div>
        <textarea style={{ ...css.input, height: 70, resize: "none" }} placeholder="Aanvullende informatie..." value={notitie} onChange={e => setNotitie(e.target.value)} />
      </div>
      <button style={{ ...css.btn, opacity: !selDatum || soorten.size === 0 || bezig ? 0.4 : 1, marginTop: 14 }} onClick={verstuur}
        disabled={!selDatum || soorten.size === 0 || bezig}>
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

function DatumKiezer({ bezetteDagen, geslotenDagen, openingstijden, value, onChange }) {
  const beschikbaar = getBeschikbareDagen(bezetteDagen, geslotenDagen, openingstijden);
  if (!beschikbaar.length) return (
    <div style={{ fontSize: 13, color: T.muted, padding: "10px 0" }}>Geen beschikbare dagen in de komende 60 dagen.</div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
      {beschikbaar.map(d => (
        <button key={d.datum} disabled={d.bezet} onClick={() => !d.bezet && onChange(d.datum)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderRadius: 6, border: `1px solid ${value === d.datum ? T.accent : T.border}`, background: value === d.datum ? T.accentSoft : d.bezet ? T.surf2 : "transparent", cursor: d.bezet ? "default" : "pointer", fontFamily: "Barlow, sans-serif", textAlign: "left" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: 1, color: d.bezet ? T.muted : value === d.datum ? T.accent : T.text, textTransform: "uppercase", width: 22 }}>{d.dag}</div>
            <div style={{ fontSize: 14, color: d.bezet ? T.muted : T.text }}>{fmtDatum(d.datum)}</div>
          </div>
          {d.bezet ? <span style={css.badge(T.muted)}>Vol</span> : value === d.datum ? <span style={css.badge(T.accent)}>✓</span> : <span style={{ fontSize: 12, color: T.muted }}>Vrij</span>}
        </button>
      ))}
    </div>
  );
}

function Contact({ openingstijden, geslotenDagen, bezetteDagen = [], opmerking, klant = {}, motoren = [], dienstenTarieven = {}, onVerzendAanvraag }) {
  const [view, setView] = useState(null);
  const [f, setF] = useState({});
  const [winOpts, setWinOpts] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [fotoBezig, setFotoBezig] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [ok, setOk] = useState(false);
  const [fout, setFout] = useState(null);

  const p = (key) => dienstenTarieven[key] ? `€ ${Number(dienstenTarieven[key]).toLocaleString("nl-NL")}` : "Op aanvraag";
  const setFld = (key, val) => setF(prev => ({ ...prev, [key]: val }));
  const openView = (id) => { setView(id); setF({}); setWinOpts([]); setFotos([]); setOk(false); setFout(null); };

  const compressImage = async (file) => {
    if (file.size <= 1024 * 1024) return file;
    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise(r => { img.onload = r; img.src = url; });
    URL.revokeObjectURL(url);
    const canvas = document.createElement('canvas');
    const MAX = 1920;
    let w = img.width, h = img.height;
    if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    let q = 0.85, blob;
    do { blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', q)); q -= 0.1; } while (blob.size > 1024 * 1024 && q > 0.1);
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  };

  const uploadFoto = async (file) => {
    setFotoBezig(true);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed);
      form.append("upload_preset", "Djm app");
      const res = await fetch("https://api.cloudinary.com/v1_1/dkfdwnep4/image/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.secure_url) setFotos(prev => [...prev, data.secure_url]);
    } catch(e) { console.error("Foto upload mislukt", e); }
    setFotoBezig(false);
  };

  const SOORTEN_MET_MOTOR = ["schade", "consignatie", "winterstalling", "seizoenscheck"];
  const stuur = async (soort) => {
    setBezig(true); setFout(null);
    const data = { ...f };
    if (SOORTEN_MET_MOTOR.includes(soort) && !data.motor_id && motoren.length > 0) data.motor_id = motoren[0].id;
    if (soort === "winterstalling" && winOpts.length > 0) data.extra_opties = winOpts.join(", ");
    if (fotos.length > 0) data.fotos = fotos;
    const err = onVerzendAanvraag ? await onVerzendAanvraag(soort, data) : null;
    setBezig(false);
    if (err) { setFout(err); return; }
    setOk(true);
    setTimeout(() => { setOk(false); setView(null); }, 2500);
  };

  const backBtn = (
    <button onClick={() => setView(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 13, padding: "0 0 16px", fontFamily: "Barlow, sans-serif" }}>
      ← Terug naar Contact
    </button>
  );

  const verzendKnop = (soort, label = "Aanvraag versturen") => (
    <button disabled={bezig || ok} onClick={() => stuur(soort)}
      style={{ ...css.btn, background: ok ? T.green : T.accent, marginTop: 14, opacity: bezig ? 0.6 : 1 }}>
      {ok ? "✓ Aanvraag verstuurd!" : bezig ? "Bezig..." : label}
    </button>
  );

  const stappenLijst = (stappen) => (
    <div style={{ ...css.card, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Stap voor stap</div>
      {stappen.map((tekst, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: i < stappen.length - 1 ? 12 : 0 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: T.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: T.text }}>{tekst}</div>
        </div>
      ))}
    </div>
  );

  const tarievenRij = (rijen) => (
    <div style={{ ...css.card, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Tarieven</div>
      {rijen.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < rijen.length - 1 ? `1px solid ${T.border}` : "none" }}>
          <span style={{ fontSize: 13, color: T.text }}>{r.lbl}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>{p(r.key)}</span>
        </div>
      ))}
    </div>
  );

  const motorSelect = motoren.length > 0 ? (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Motor</label>
      <select style={css.input} value={f.motor_id || motoren[0]?.id || ""} onChange={e => setFld("motor_id", e.target.value)}>
        {motoren.map(m => <option key={m.id} value={m.id}>{m.merk} {m.model}{m.kenteken ? ` (${m.kenteken})` : ""}</option>)}
      </select>
    </div>
  ) : null;

  const datumKiezer = (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Kies een dag</div>
      <DatumKiezer bezetteDagen={bezetteDagen} geslotenDagen={geslotenDagen} openingstijden={openingstijden} value={f.datum || ""} onChange={val => setFld("datum", val)} />
    </div>
  );

  const fotoUpload = (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Foto's toevoegen (optioneel)</div>
      {fotos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {fotos.map((url, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.border}` }}/>
              <button onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: T.red, border: "none", color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, lineHeight: 1, padding: 0 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: T.surf2, border: `1px solid ${T.border}`, borderRadius: 8, cursor: fotoBezig ? "default" : "pointer", fontSize: 13, color: T.muted, opacity: fotoBezig ? 0.6 : 1 }}>
        <input type="file" accept="image/*" style={{ display: "none" }} disabled={fotoBezig} onChange={e => { if (e.target.files[0]) uploadFoto(e.target.files[0]); e.target.value = ""; }}/>
        {fotoBezig ? "Uploaden..." : "+ Foto toevoegen"}
      </label>
    </div>
  );

  // ── Schade ──────────────────────────────────────────────────────────────
  if (view === "schade") return (
    <div>
      {backBtn}
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: 1, marginBottom: 4 }}>SCHADE</div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.8 }}>
        Schade aan je motor? Vervelend!<br/>
        We hopen dat het goed gaat. Hieronder stap voor stap wat je nu moet doen.
      </div>
      <div style={{ ...css.card, marginBottom: 16 }}>
        {[
          { titel: "Meld de schade bij je verzekeraar", tekst: "Doe dit via de app of website van je verzekeraar. Stuur je ingevulde schadeformulier mee." },
          { titel: "Vraag of je motor bij ons gerepareerd mag worden", tekst: "Dit mag bij de meeste verzekeringen of staat vermeld in je polis." },
          { titel: "Plan een afspraak bij ons in", knop: true },
          { titel: "Lever je motor minimaal 3 werkdagen voor het expertbezoek in", tekst: "Wij stellen een schadecalculatie op. Bij schade boven €500 schakelt je verzekeraar een expert in (zie stap 5). Daaronder handelt de verzekeraar het af op basis van onze calculatie." },
          { titel: "Expertbezoek (alleen bij schade boven €500)", tekst: "De expert komt bij ons langs. Wij overleggen ter plekke en vragen goedkeuring voor de reparatie." },
          { titel: "Reparatie", tekst: "Pas ná goedkeuring starten wij met de reparatie. Je eigen risico is voor jouw rekening — check je polis." },
        ].map((s, i, arr) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: i < arr.length - 1 ? 16 : 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: T.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: s.tekst || s.knop ? 4 : 0 }}>{s.titel}</div>
              {s.tekst && <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.7 }}>{s.tekst}</div>}
              {s.knop && (
                <a href="#schade-form" onClick={e => { e.preventDefault(); document.getElementById("schade-form")?.scrollIntoView({ behavior: "smooth" }); }}
                  style={{ display: "inline-block", marginTop: 6, padding: "8px 16px", background: T.accent, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}>
                  Afspraak inplannen
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <div id="schade-form" style={css.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Afspraak inplannen</div>
        {motorSelect}
        {datumKiezer}
        {fotoUpload}
        {fout && <div style={{ color: T.red, fontSize: 12, marginTop: 8 }}>{fout}</div>}
        {verzendKnop("schade", "Afspraak aanvragen")}
      </div>
    </div>
  );

  // ── Consignatie ──────────────────────────────────────────────────────────
  if (view === "consignatie") return (
    <div>
      {backBtn}
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: 1, marginBottom: 4 }}>CONSIGNATIE</div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.8 }}>
        Wij verkopen uw motor voor u.<br/>
        Breng uw motor en wij doen de rest.
      </div>
      {tarievenRij([
        { lbl: "Week 1–4", key: "consignatie_w1_4" },
        { lbl: "Week 5–12 (verlenging)", key: "consignatie_w5_12" },
        { lbl: "Week 13–26 (verlenging)", key: "consignatie_w13_26" },
        { lbl: "Extra platform per 4 weken", key: "consignatie_platform" },
      ])}
      {stappenLijst([
        "U rijdt uw motor langs voor een waardebepaling",
        "Bij akkoord poetsen wij uw motor en plaatsen hem in onze showroom en online",
        "Wij regelen de bezichtigingen en onderhandelingen",
        "Na verkoop wordt het bedrag met u verrekend",
      ])}
      <div style={css.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Afspraak aanvragen</div>
        {motorSelect}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Minimale te ontvangen prijs</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 13, pointerEvents: "none" }}>€</span>
            <input style={{ ...css.input, paddingLeft: 28, marginBottom: 0 }} type="number" min="0" value={f.min_prijs || ""} onChange={e => setFld("min_prijs", e.target.value)} placeholder="Bijv. 2500"/>
          </div>
        </div>
        {datumKiezer}
        {fout && <div style={{ color: T.red, fontSize: 12, marginTop: 8 }}>{fout}</div>}
        {verzendKnop("consignatie", "Afspraak aanvragen")}
      </div>
    </div>
  );

  // ── Aankoopkeuring ───────────────────────────────────────────────────────
  if (view === "aankoopkeuring") return (
    <div>
      {backBtn}
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: 1, marginBottom: 4 }}>AANKOOPKEURING</div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.8 }}>Laat een tweedehands motor keuren vóór aankoop. Wij rijden naar de verkoper toe.</div>
      {tarievenRij([
        { lbl: "Basis (incl. 20 min enkele reis)", key: "aankoopkeuring_basis" },
        { lbl: "Per extra 10 min rijden", key: "aankoopkeuring_extra_10min" },
      ])}
      <div style={{ ...css.card, background: `${T.accent}08`, border: `1px solid ${T.accent}30`, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 1.7 }}>
          U kiest geen datum — wij plannen de keuring in en laten u weten wanneer wij gaan.
        </div>
      </div>
      <div style={css.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Keuring aanvragen</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Locatie van de motor</label>
          <input style={{ ...css.input, marginBottom: 0 }} value={f.locatie || ""} onChange={e => setFld("locatie", e.target.value)} placeholder="Stad of adres van de verkoper"/>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Link naar advertentie (optioneel)</label>
          <input style={{ ...css.input, marginBottom: 0 }} type="url" value={f.advertentie_url || ""} onChange={e => setFld("advertentie_url", e.target.value)} placeholder="https://www.marktplaats.nl/..."/>
        </div>
        <div style={{ marginBottom: 4 }}>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Notities</label>
          <textarea style={{ ...css.input, height: 70, resize: "vertical", marginBottom: 0 }} value={f.opmerking || ""} onChange={e => setFld("opmerking", e.target.value)} placeholder="Bijv. merk, model en uw opmerkingen..."/>
        </div>
        {fout && <div style={{ color: T.red, fontSize: 12, marginTop: 8 }}>{fout}</div>}
        {verzendKnop("aankoopkeuring")}
      </div>
    </div>
  );

  // ── Zoekopdracht ─────────────────────────────────────────────────────────
  if (view === "zoekopdracht") return (
    <div>
      {backBtn}
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: 1, marginBottom: 4 }}>ZOEKOPDRACHT</div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.8 }}>Wij zoeken voor u de perfecte motor. Geef uw wensen op en wij regelen de rest.</div>
      <div style={{ ...css.card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0 8px" }}>
          <span style={{ fontSize: 13 }}>Bemiddelingskosten</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>{p("zoekopdracht_bemiddeling")}</span>
        </div>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7 }}>Alleen in rekening gebracht bij een succesvolle aankoop. Excl. transport, rijklaar maken en RDW kosten.</div>
      </div>
      <div style={css.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Uw zoekopdracht</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Merk</label>
            <input style={{ ...css.input, marginBottom: 0 }} value={f.merk || ""} onChange={e => setFld("merk", e.target.value)} placeholder="Bijv. Honda"/>
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Model</label>
            <input style={{ ...css.input, marginBottom: 0 }} value={f.model || ""} onChange={e => setFld("model", e.target.value)} placeholder="Bijv. CB500F"/>
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Bouwjaar (v.a.)</label>
            <input style={{ ...css.input, marginBottom: 0 }} type="number" value={f.bouwjaar || ""} onChange={e => setFld("bouwjaar", e.target.value)} placeholder="2015"/>
          </div>
          <div>
            <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Max km-stand</label>
            <input style={{ ...css.input, marginBottom: 0 }} type="number" value={f.km || ""} onChange={e => setFld("km", e.target.value)} placeholder="30000"/>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Budget (max)</label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 13, pointerEvents: "none" }}>€</span>
            <input style={{ ...css.input, paddingLeft: 28, marginBottom: 0 }} type="number" value={f.budget || ""} onChange={e => setFld("budget", e.target.value)} placeholder="5000"/>
          </div>
        </div>
        <div style={{ marginBottom: 4 }}>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Overige wensen</label>
          <textarea style={{ ...css.input, height: 80, resize: "vertical", marginBottom: 0 }} value={f.opmerking || ""} onChange={e => setFld("opmerking", e.target.value)} placeholder="Bijv. kleur, type, vermogen..."/>
        </div>
        {fout && <div style={{ color: T.red, fontSize: 12, marginTop: 8 }}>{fout}</div>}
        {verzendKnop("zoekopdracht")}
      </div>
    </div>
  );

  // ── Winterstalling ───────────────────────────────────────────────────────
  if (view === "winterstalling") return (
    <div>
      {backBtn}
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: 1, marginBottom: 4 }}>WINTERSTALLING</div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.8 }}>Stal uw motor veilig en droog op bij ons. Inclusief optionele onderhoudsdiensten. <span style={{ fontStyle: "italic" }}>(Alles met 10% korting bij uitvoeren in combinatie met winterstalling.)</span></div>
      {tarievenRij([
        { lbl: "6 maanden (okt–mrt)", key: "winterstalling_6mnd" },
        { lbl: "Per extra maand", key: "winterstalling_extra_mnd" },
        { lbl: "Kleine onderhoudsbeurt", key: "winterstalling_kleine_beurt" },
        { lbl: "Grote onderhoudsbeurt", key: "winterstalling_grote_beurt" },
        { lbl: "Bandenwisselen (voor / achter)", key: "winterstalling_banden" },
        { lbl: "Poetsen & bescherming", key: "winterstalling_poetsen" },
      ])}
      <div style={css.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Aanmelden voor winterstalling</div>
        {motorSelect}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Extra opties</div>
          {[
            { id: "kleine_beurt", lbl: "Kleine onderhoudsbeurt" },
            { id: "grote_beurt", lbl: "Grote onderhoudsbeurt" },
            { id: "voorband", lbl: "Voorband wisselen" },
            { id: "achterband", lbl: "Achterband wisselen" },
            { id: "poetsen", lbl: "Poetsen & bescherming" },
          ].map(opt => (
            <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 8 }}>
              <input type="checkbox" checked={winOpts.includes(opt.id)} onChange={e => setWinOpts(prev => e.target.checked ? [...prev, opt.id] : prev.filter(o => o !== opt.id))} style={{ accentColor: T.accent, width: 16, height: 16 }}/>
              <span style={{ fontSize: 13 }}>{opt.lbl}</span>
            </label>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Opmerkingen</label>
          <textarea style={{ ...css.input, height: 60, resize: "vertical", marginBottom: 0 }} value={f.opmerking || ""} onChange={e => setFld("opmerking", e.target.value)} placeholder="Eventuele opmerkingen..."/>
        </div>
        {datumKiezer}
        {fout && <div style={{ color: T.red, fontSize: 12, marginTop: 8 }}>{fout}</div>}
        {verzendKnop("winterstalling", "Aanmelden winterstalling")}
      </div>
    </div>
  );

  // ── Seizoensklaarmaak ────────────────────────────────────────────────────
  if (view === "seizoensklaarmaak") return (
    <div>
      {backBtn}
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: 1, marginBottom: 4 }}>SEIZOENSCHECK</div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.8 }}>Klaar voor het nieuwe seizoen? Wij maken uw motor rijklaar.</div>
      <div style={{ ...css.card, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0 8px" }}>
          <span style={{ fontSize: 13 }}>Seizoenscheck</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.accent }}>{p("seizoensklaarmaak")}</span>
        </div>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7 }}>Wij checken vloeistoffen, accu, banden en algemene controle. (let op: dit is alleen een controle en geven advies, geen vervanging)</div>
      </div>
      <div style={css.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Afspraak aanvragen</div>
        {motorSelect}
        {datumKiezer}
        <div style={{ marginBottom: 4 }}>
          <label style={{ fontSize: 12, color: T.muted, display: "block", marginBottom: 4 }}>Opmerkingen</label>
          <textarea style={{ ...css.input, height: 60, resize: "vertical", marginBottom: 0 }} value={f.opmerking || ""} onChange={e => setFld("opmerking", e.target.value)} placeholder="Eventuele opmerkingen..."/>
        </div>
        {fout && <div style={{ color: T.red, fontSize: 12, marginTop: 8 }}>{fout}</div>}
        {verzendKnop("seizoensklaarmaak")}
      </div>
    </div>
  );

  // ── Hoofdview ────────────────────────────────────────────────────────────
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
        <a href="https://www.google.com/maps/dir/?api=1&destination=Stevinweg+14,+Tholen"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 13, color: T.accent, marginTop: 10, lineHeight: 1.8, display: "block", textDecoration: "none" }}>
          📍 Stevinweg 14, Tholen →
        </a>
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
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <div style={css.sectionTitle}>Overige diensten</div>
        {[
          { id: "schade",            icon: "🔧", label: "Schade",             sub: "Reparatie & inspectie" },
          { id: "consignatie",       icon: "🏷️", label: "Consignatie",        sub: "Wij verkopen uw motor" },
          { id: "aankoopkeuring",    icon: "🔍", label: "Aankoopkeuring",     sub: "Keuring vóór aankoop" },
          { id: "zoekopdracht",      icon: "🔎", label: "Zoekopdracht",       sub: "Wij zoeken uw motor" },
          { id: "winterstalling",    icon: "❄️", label: "Winterstalling",     sub: "Veilig stallen" },
          { id: "seizoensklaarmaak", icon: "☀️", label: "Seizoenscheck",  sub: "Motor rijklaar maken" },
        ].map(svc => (
          <button key={svc.id} onClick={() => openView(svc.id)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, background: T.surf, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 10, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "Barlow, sans-serif", color: T.text }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${T.accent}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{svc.icon}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{svc.label}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{svc.sub}</div>
            </div>
            <div style={{ marginLeft: "auto", color: T.muted, fontSize: 16 }}>→</div>
          </button>
        ))}
      </div>
      <WeekKalender openingstijden={openingstijden} geslotenDagen={geslotenDagen} />
    </div>
  );
}

// ── Scherm: Instellingen ───────────────────────────────────────────────────
function Instellingen({ klant, motoren, hoofdMotorId, onKiesHoofd, onUpdateKlant, onVoegMotorToe, onVerwijderMotor, onWijzigWachtwoord, onUpdateBanden, themeMode="automatisch", onThemeMode=()=>{}, autoOpenMotorForm=false, onMotorFormOpened=()=>{} }) {
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

  useEffect(() => {
    if (autoOpenMotorForm) {
      setToonMotorForm(true);
      onMotorFormOpened();
    }
  }, [autoOpenMotorForm]);

  const [menuMotorId, setMenuMotorId] = useState(null);
  const [wijzigMotorId, setWijzigMotorId] = useState(null);
  const [wijzigF, setWijzigF] = useState({ voorband_maat:"", achterband_maat:"", bijzonderheden:"" });
  const [wijzigBezig, setWijzigBezig] = useState(false);
  const [wijzigOk, setWijzigOk] = useState(false);
  const [wijzigFout, setWijzigFout] = useState(null);

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

      {/* Motoren beheren — boven wachtwoord */}
      <div style={css.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={css.sectionTitle}>Mijn motoren</div>
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
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => onKiesHoofd(m.id)} title={m.id === hoofdMotorId ? "Hoofdvoertuig" : "Instellen als hoofdvoertuig"}
                  style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: "4px 2px", lineHeight: 1, color: m.id === hoofdMotorId ? T.accent : T.muted, opacity: m.id === hoofdMotorId ? 1 : 0.5 }}>
                  {m.id === hoofdMotorId ? "★" : "☆"}
                </button>
                <div style={{ position:"relative" }}>
                  <button onClick={() => setMenuMotorId(menuMotorId === m.id ? null : m.id)}
                    style={{ background:"none", border:"none", color:T.muted, fontSize:20, cursor:"pointer", padding:"4px 6px", lineHeight:1, fontWeight:700, letterSpacing:1 }}>⋮</button>
                  {menuMotorId === m.id && (
                    <div style={{ position:"absolute", right:0, top:"100%", background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, boxShadow:"0 4px 16px rgba(0,0,0,0.12)", zIndex:100, minWidth:140, overflow:"hidden" }}>
                      <button onClick={() => { setMenuMotorId(null); setWijzigMotorId(m.id); setWijzigF({ voorband_maat:m.voorband_maat||"", achterband_maat:m.achterband_maat||"", bijzonderheden:m.bijzonderheden||"" }); setWijzigOk(false); setWijzigFout(null); }}
                        style={{ display:"block", width:"100%", padding:"11px 16px", background:"none", border:"none", textAlign:"left", fontSize:13, cursor:"pointer", fontFamily:"Barlow, sans-serif", color:T.text, borderBottom:`1px solid ${T.border}` }}>
                        Wijzigen
                      </button>
                      <button onClick={() => { setMenuMotorId(null); setVerwijderBevestigId(verwijderBevestigId === m.id ? null : m.id); setVerwijderFout(null); }}
                        style={{ display:"block", width:"100%", padding:"11px 16px", background:"none", border:"none", textAlign:"left", fontSize:13, cursor:"pointer", fontFamily:"Barlow, sans-serif", color:T.red }}>
                        Verwijderen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {wijzigMotorId === m.id && (
              <div style={{ background:T.surf2, border:`1px solid ${T.border}`, borderRadius:8, padding:"14px 12px", margin:"6px 0 8px" }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:12 }}>Bandenmaat & bijzonderheden</div>
                <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Maat voorband</label>
                <input style={{ ...css.input, marginBottom:10 }} value={wijzigF.voorband_maat} onChange={e=>setWijzigF(p=>({...p,voorband_maat:e.target.value}))} placeholder="120/70 ZR17"/>
                <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Maat achterband</label>
                <input style={{ ...css.input, marginBottom:10 }} value={wijzigF.achterband_maat} onChange={e=>setWijzigF(p=>({...p,achterband_maat:e.target.value}))} placeholder="180/55 ZR17"/>
                <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Bijzonderheden</label>
                <textarea style={{ ...css.input, height:64, resize:"none", marginBottom:12 }} value={wijzigF.bijzonderheden} onChange={e=>setWijzigF(p=>({...p,bijzonderheden:e.target.value}))} placeholder="Modificaties, aandachtspunten..."/>
                {wijzigFout && <div style={{ fontSize:12, color:T.red, marginBottom:8 }}>{wijzigFout}</div>}
                {wijzigOk && <div style={{ fontSize:12, color:T.green, marginBottom:8, fontWeight:600 }}>✓ Opgeslagen!</div>}
                <div style={{ display:"flex", gap:8 }}>
                  <button style={{ ...css.btn, flex:1, opacity:wijzigBezig?0.5:1 }} disabled={wijzigBezig} onClick={async()=>{
                    setWijzigBezig(true); setWijzigFout(null);
                    const err = await onUpdateBanden(m.id, wijzigF);
                    setWijzigBezig(false);
                    if (err) { setWijzigFout(err); return; }
                    setWijzigOk(true);
                    setTimeout(() => { setWijzigOk(false); setWijzigMotorId(null); }, 1500);
                  }}>
                    {wijzigBezig ? "Opslaan..." : "Opslaan"}
                  </button>
                  <button style={{ ...css.btnGhost }} onClick={() => setWijzigMotorId(null)}>Annuleer</button>
                </div>
              </div>
            )}
            {verwijderBevestigId === m.id && (
              <div style={{ background: `${T.red}12`, border: `1px solid ${T.red}35`, borderRadius: 6, padding: "10px 12px", margin: "6px 0 8px" }}>
                <div style={{ fontSize: 13, color: T.red, marginBottom: 8, fontWeight: 600 }}>{m.merk} {m.model} verwijderen?</div>
                {verwijderFout && <div style={{ fontSize: 12, color: T.red, marginBottom: 8 }}>{verwijderFout}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => verwijderMotor(m.id)} disabled={verwijderBezig}
                    style={{ flex: 1, padding: "8px", background: T.red, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif", opacity: verwijderBezig ? 0.6 : 1 }}>
                    {verwijderBezig ? "..." : "Ja, verwijder"}
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
              Vul het kenteken in en druk op Ophalen om gegevens automatisch op te halen.
            </div>
            <label style={lbl}>Kenteken</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input style={{ ...css.input, flex: 1 }} type="text" value={motorForm.kenteken}
                onChange={e => { setMotorForm(p => ({...p, kenteken: e.target.value.toUpperCase()})); setRdwFout(null); }}
                placeholder="AA-123-BB" />
              <button onClick={rdwOphalen} disabled={rdwBezig}
                style={{ flexShrink: 0, padding: "11px 14px", background: T.accentSoft, border: `1px solid ${T.accent}40`, borderRadius: 6, color: T.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif", opacity: rdwBezig ? 0.6 : 1 }}>
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
                  onChange={e => setMotorForm(p => ({...p, bouwjaar: e.target.value}))} placeholder="2018" />
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

      {/* Wachtwoord — onderaan */}
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

      {/* Thema */}
      <div style={css.card}>
        <div style={css.sectionTitle}>Thema</div>
        <div style={{ display:"flex", gap:0, background:T.surf2, borderRadius:8, padding:3, border:`1px solid ${T.border}` }}>
          {[["licht","☀ Licht"],["automatisch","◑ Automatisch"],["donker","☾ Donker"]].map(([m,lbl])=>(
            <button key={m} onClick={()=>onThemeMode(m)}
              style={{ flex:1, padding:"10px 4px", background:themeMode===m?T.surf:"transparent", border:"none", borderRadius:6, color:themeMode===m?T.text:T.muted, fontSize:13, fontWeight:themeMode===m?600:400, cursor:"pointer", fontFamily:"Barlow, sans-serif", transition:"all 0.1s" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Uitloggen */}
      <button onClick={uitloggen} style={{ ...css.btnGhost, marginTop: 4 }}>Uitloggen</button>
    </div>
  );
}

// ── Scherm: Service & Afspraken ────────────────────────────────────────────
function ServiceTab({ motoren, selMotorId, onSelMotor, bezetteDagen, geslotenDagen, openingstijden, onSlaAfspraakOp, onWijzigService, afspraakSoorten = [], eigenAfspraken = [] }) {
  const [afspraakOpen, setAfspraakOpen] = useState(false);

  const komende = eigenAfspraken.filter(a => a.status !== "afgewerkt").sort((a,b) => (a.datum||"").localeCompare(b.datum||""));
  const afgewerkt = eigenAfspraken.filter(a => a.status === "afgewerkt").sort((a,b) => (b.datum||"").localeCompare(a.datum||"")).slice(0,3);

  const statusBadge = (status) => {
    if (status === "gepland") return { label:"Bevestigd ✓", bg:`${T.green}20`, color:T.green, border:`1px solid ${T.green}50` };
    if (status === "afgewerkt") return { label:"Afgewerkt ✓", bg:`${T.green}15`, color:T.green, border:`1px solid ${T.green}40` };
    return { label:"In behandeling", bg:"#f59e0b20", color:"#b45309", border:"1px solid #f59e0b50" };
  };

  const fmtAfspraakLabel = (a) => {
    const parts = [a.soort, a.type==="proefrit"?"Proefrit":null].filter(Boolean);
    return parts.length ? parts.join(" · ") : (a.type==="intern"?"Interne afspraak":"Afspraak");
  };

  if (afspraakOpen) {
    return (
      <div>
        <button onClick={() => setAfspraakOpen(false)}
          style={{ background:"none", border:"none", color:T.accent, fontSize:13, cursor:"pointer", fontFamily:"Barlow, sans-serif", padding:"0 0 16px", display:"flex", alignItems:"center", gap:4 }}>
          ← Terug naar service
        </button>
        <Afspraak
          motoren={motoren} selMotorId={selMotorId} onSelMotor={onSelMotor}
          bezetteDagen={bezetteDagen} geslotenDagen={geslotenDagen} openingstijden={openingstijden}
          afspraakSoorten={afspraakSoorten}
          onSlaOp={async (f) => { await onSlaAfspraakOp(f); setAfspraakOpen(false); }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Aankomende & recente afspraken */}
      {(komende.length > 0 || afgewerkt.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:15, letterSpacing:1, color:T.text, marginBottom:10 }}>MIJN AFSPRAKEN</div>
          {komende.map(a => {
            const sb = statusBadge(a.status);
            const datumStr = a.datum ? new Date(a.datum+"T00:00:00").toLocaleDateString("nl-NL",{weekday:"short",day:"numeric",month:"short"}) : "—";
            return (
              <div key={a.id} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:3 }}>{fmtAfspraakLabel(a)}</div>
                  <div style={{ fontSize:12, color:T.muted }}>{datumStr}{a.tijd ? ` · ${a.tijd}` : ""}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:10, background:sb.bg, color:sb.color, border:sb.border, whiteSpace:"nowrap", flexShrink:0 }}>{sb.label}</span>
              </div>
            );
          })}
          {afgewerkt.map(a => {
            const sb = statusBadge(a.status);
            const datumStr = a.datum ? new Date(a.datum+"T00:00:00").toLocaleDateString("nl-NL",{weekday:"short",day:"numeric",month:"short"}) : "—";
            return (
              <div key={a.id} style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10, opacity:0.7 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:3 }}>{fmtAfspraakLabel(a)}</div>
                  <div style={{ fontSize:12, color:T.muted }}>{datumStr}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:10, background:sb.bg, color:sb.color, border:sb.border, whiteSpace:"nowrap", flexShrink:0 }}>{sb.label}</span>
              </div>
            );
          })}
          <button onClick={() => setAfspraakOpen(true)}
            style={{ width:"100%", padding:"10px", background:T.accent, color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"Barlow, sans-serif", marginTop:4 }}>
            + Nieuwe afspraak aanvragen
          </button>
        </div>
      )}

      <Servicegeschiedenis
        motoren={motoren} selMotorId={selMotorId} onSelMotor={onSelMotor}
        onWijzigService={onWijzigService}
        actieKnop={komende.length === 0 && afgewerkt.length === 0 ? (
          <button
            style={{ padding: "9px 14px", background: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}
            onClick={() => setAfspraakOpen(true)}>
            + Nieuwe afspraak maken
          </button>
        ) : null}
      />
    </div>
  );
}

// ── Scherm: Voorraad ───────────────────────────────────────────────────────
const clImg = (url, w = 600) => url ? url.replace("/upload/", `/upload/c_scale,w_${w},q_auto:eco,f_auto/`) : url;

function VoorraadTab({ voorraad, producten = [], klant, geslotenDagen = [], openingstijden = null, onSlaProefritOp, onNaarContact }) {
  const [subTab, setSubTab] = useState("motoren");
  const [detailMotor, setDetailMotor] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [motorView, setMotorView] = useState("detail");
  const [productView, setProductView] = useState("detail");
  const [lichtbakFoto, setLichtbakFoto] = useState(null);
  const [f, setF] = useState({ naam:"", telefoon:"", email:"", datum:null, opmerking:"" });
  const [bezig, setBezig] = useState(false);

  const DAGMAP = ["zo","ma","di","wo","do","vr","za"];
  const isOpenDag = (dow) => {
    if (openingstijden) return openingstijden[DAGMAP[dow]]?.gesloten !== true;
    return [3,4,5].includes(dow);
  };
  const beschikbaar = (() => {
    const dagen = [];
    const start = new Date(TODAY);
    start.setDate(start.getDate() + 1);
    for (let i = 0; i <= 60; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dow = d.getDay();
      if (!isOpenDag(dow)) continue;
      const iso = d.toISOString().split("T")[0];
      if (geslotenDagen.includes(iso)) continue;
      dagen.push({ datum: iso, dag: DAGMAP[dow] });
    }
    return dagen;
  })();

  const verstuurProefrit = async () => {
    if (!f.datum || !f.naam || !f.telefoon || bezig) return;
    setBezig(true);
    await onSlaProefritOp({ voorraadMotorId: detailMotor.id, datum: f.datum, naam: f.naam, telefoon: f.telefoon, email: f.email, opmerking: f.opmerking });
    setBezig(false);
    setMotorView("verstuurd");
  };

  // ── Motor card (grid) ──
  const renderMotorCard = (motor) => {
    const fotos = Array.isArray(motor.fotos) ? motor.fotos : [];
    const isVerkocht = !!motor.verkocht_op;
    const isGereserveerd = motor.status === "gereserveerd" && !isVerkocht;
    return (
      <div key={motor.id} onClick={() => { setDetailMotor(motor); setMotorView("detail"); }}
        style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:6, padding:20, cursor:"pointer" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = T.accent + "80"}
        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
        {fotos.length > 0 ? (
          <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:12, marginLeft:-20, marginRight:-20, paddingLeft:20, paddingRight:20, paddingBottom:6 }}>
            {fotos.map((url, i) => (
              <img key={i} src={clImg(url, 400)} alt=""
                style={{ height:130, width:"auto", objectFit:"cover", borderRadius:4, flexShrink:0, border:`1px solid ${T.border}`, filter: isVerkocht ? "grayscale(25%)" : "none" }} />
            ))}
          </div>
        ) : (
          <div style={{ height:90, background:T.surf2, borderRadius:4, marginBottom:12, display:"flex", alignItems:"center", justifyContent:"center", color:T.muted, fontSize:12 }}>Geen foto's</div>
        )}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:700, fontSize:18 }}>{motor.merk} {motor.model}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center", marginTop:4 }}>
              {isGereserveerd && <span style={{ ...css.badge(T.yellow) }}>Gereserveerd</span>}
              {isVerkocht && <span style={{ ...css.badge(T.green) }}>Verkocht</span>}
            </div>
          </div>
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:22, color: isVerkocht ? T.green : T.accent, flexShrink:0, marginLeft:8 }}>
            {isVerkocht ? "Verkocht" : `€${motor.prijs?.toLocaleString()}`}
          </div>
        </div>
        <div style={{ fontSize:12, color:T.muted, lineHeight:1.8 }}>
          {motor.bouwjaar} · {motor.km?.toLocaleString()} km
        </div>
      </div>
    );
  };

  // ── Product card (grid) ──
  const renderProductCard = (prod) => {
    const fotos = Array.isArray(prod.fotos) ? prod.fotos : [];
    return (
      <div key={prod.id} onClick={() => { setDetailProduct(prod); setProductView("detail"); }}
        style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden", cursor:"pointer" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = T.accent + "80"}
        onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
        {fotos.length > 0 ? (
          <img src={clImg(fotos[0], 400)} alt="" style={{ width:"100%", height:150, objectFit:"cover", display:"block" }} />
        ) : (
          <div style={{ height:110, background:T.surf2, display:"flex", alignItems:"center", justifyContent:"center", color:T.muted, fontSize:12 }}>Geen foto</div>
        )}
        <div style={{ padding:"12px 14px 14px" }}>
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:700, fontSize:18, marginBottom:4 }}>{prod.naam}</div>
          {prod.omschrijving && <div style={{ fontSize:12, color:T.muted, marginBottom:6, lineHeight:1.5 }}>{prod.omschrijving}</div>}
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:18, color:T.accent }}>
            {prod.prijs != null ? `€${prod.prijs.toLocaleString()}` : "Op aanvraag"}
          </div>
        </div>
      </div>
    );
  };

  // ── Motor detail modal ──
  const renderMotorModal = () => {
    const m = detailMotor;
    if (!m) return null;
    const fotos = Array.isArray(m.fotos) ? m.fotos : [];
    const isVerkocht = !!m.verkocht_op;
    const specs = [
      ["Bouwjaar", m.bouwjaar],
      ["Kilometerstand", m.km ? `${m.km.toLocaleString()} km` : "—"],
      ["Kenteken", m.kenteken],
      ...(m.datum_in ? [["In showroom", fmtDatum(m.datum_in)]] : []),
      ...(m.voorband_datum ? [["Voorband", m.voorband_datum]] : []),
      ...(m.achterband_datum ? [["Achterband", m.achterband_datum]] : []),
    ].filter(([,v]) => v);
    return (
      <>
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e => { if (e.target === e.currentTarget) { setDetailMotor(null); setLichtbakFoto(null); }}}>
          <div style={{ background:T.surf, borderRadius:10, maxWidth:640, width:"100%", maxHeight:"90vh", overflowY:"auto", position:"relative" }}>
            <button onClick={() => setDetailMotor(null)}
              style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.55)", border:"none", color:"#fff", fontSize:18, cursor:"pointer", zIndex:2, lineHeight:1, width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            {fotos.length > 0 ? (
              <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"16px 16px 6px" }}>
                {fotos.map((url, i) => (
                  <img key={i} src={clImg(url, 600)} alt=""
                    onClick={e => { e.stopPropagation(); setLichtbakFoto(url); }}
                    style={{ height:200, width:"auto", objectFit:"cover", borderRadius:8, flexShrink:0, cursor:"zoom-in", border:`1px solid ${T.border}` }} />
                ))}
              </div>
            ) : (
              <div style={{ height:140, background:T.surf2, borderRadius:"10px 10px 0 0", display:"flex", alignItems:"center", justifyContent:"center", color:T.muted, fontSize:13 }}>Geen foto's</div>
            )}
            {fotos.length > 1 && <div style={{ fontSize:11, color:T.muted, textAlign:"center", paddingTop:6 }}>Klik op een foto voor grotere weergave</div>}
            <div style={{ padding:"16px 20px 24px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div>
                  <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:900, fontSize:26, lineHeight:1.1 }}>{m.merk} {m.model}</div>
                  <div style={{ display:"flex", gap:6, marginTop:5, flexWrap:"wrap" }}>
                    <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:3, fontSize:12, fontWeight:700, background:`${T.yellow}15`, color:T.text, border:`1px solid ${T.yellow}70`, fontFamily:"Barlow Condensed, sans-serif", letterSpacing:1 }}>{m.kenteken}</span>
                    {isVerkocht && <span style={{ ...css.badge(T.green) }}>Verkocht</span>}
                    {m.status==="gereserveerd" && !isVerkocht && <span style={{ ...css.badge(T.yellow) }}>Gereserveerd</span>}
                  </div>
                </div>
                <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:28, color: isVerkocht ? T.green : T.accent, flexShrink:0, marginLeft:12 }}>
                  {isVerkocht ? "Verkocht" : `€${m.prijs?.toLocaleString()}`}
                </div>
              </div>

              {motorView === "detail" && (
                <>
                  <div style={{ marginBottom:16 }}>
                    {specs.map(([label, val]) => (
                      <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${T.border}` }}>
                        <div style={{ fontSize:13, color:T.muted }}>{label}</div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  {isVerkocht ? (
                    <div style={{ background:`${T.green}12`, border:`1px solid ${T.green}40`, borderRadius:8, padding:"12px 16px", textAlign:"center" }}>
                      <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:700, fontSize:16, color:T.green }}>✓ Verkocht</div>
                      <div style={{ fontSize:13, color:T.muted, marginTop:4, lineHeight:1.6 }}>Deze motor is verkocht. Bekijk ons andere aanbod!</div>
                    </div>
                  ) : (
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      <button style={{ ...css.btn, flex:1, minWidth:160 }} onClick={() => { setF({ naam:klant?.naam||"", telefoon:klant?.telefoon||"", email:klant?.email||"", datum:null, opmerking:"" }); setMotorView("proefrit"); }}>
                        Proefrit aanvragen →
                      </button>
                      <button style={{ ...css.btn, flex:1, minWidth:160, background:T.green }} onClick={() => setMotorView("aanbetaling")}>
                        Aanbetalen — €500
                      </button>
                    </div>
                  )}
                </>
              )}

              {motorView === "proefrit" && (
                <>
                  <button onClick={() => setMotorView("detail")} style={{ background:"none", border:"none", color:T.accent, fontSize:13, cursor:"pointer", fontFamily:"Barlow, sans-serif", padding:"0 0 12px", display:"flex", alignItems:"center", gap:4 }}>
                    ← Terug naar details
                  </button>
                  <div style={{ ...css.card, marginBottom:10 }}>
                    <div style={css.sectionTitle}>Jouw gegevens</div>
                    <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Naam *</label>
                    <input style={{ ...css.input, marginBottom:10 }} value={f.naam} onChange={e => setF(p => ({...p, naam:e.target.value}))} placeholder="Voornaam Achternaam" />
                    <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Telefoonnummer *</label>
                    <input style={{ ...css.input, marginBottom:10 }} type="tel" value={f.telefoon} onChange={e => setF(p => ({...p, telefoon:e.target.value}))} placeholder="06-12345678" />
                    <label style={{ fontSize:11, color:T.muted, display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>E-mailadres</label>
                    <input style={css.input} type="email" value={f.email} onChange={e => setF(p => ({...p, email:e.target.value}))} placeholder="jouw@email.nl" />
                  </div>
                  <div style={{ ...css.card, marginBottom:10 }}>
                    <div style={css.sectionTitle}>Kies een dag</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {beschikbaar.slice(0,20).map(d => (
                        <button key={d.datum} onClick={() => setF(p => ({...p, datum:d.datum}))}
                          style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderRadius:6, border:`1px solid ${f.datum===d.datum?T.green:T.border}`, background:f.datum===d.datum?`${T.green}15`:"transparent", cursor:"pointer", fontFamily:"Barlow, sans-serif" }}>
                          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                            <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:700, fontSize:12, letterSpacing:1, color:f.datum===d.datum?T.green:T.text, textTransform:"uppercase", width:22 }}>{d.dag}</div>
                            <div style={{ fontSize:13, color:T.text }}>{fmtDatum(d.datum)}</div>
                          </div>
                          {f.datum===d.datum && <span style={{ ...css.badge(T.green) }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ ...css.card, marginBottom:10 }}>
                    <div style={css.sectionTitle}>Opmerkingen (optioneel)</div>
                    <textarea style={{ ...css.input, height:60, resize:"none" }}
                      placeholder="Voorkeur ochtend/middag, rijervaring..."
                      value={f.opmerking} onChange={e => setF(p => ({...p, opmerking:e.target.value}))} />
                  </div>
                  <button style={{ ...css.btn, opacity:(!f.datum||!f.naam||!f.telefoon||bezig)?0.4:1 }}
                    onClick={verstuurProefrit} disabled={!f.datum||!f.naam||!f.telefoon||bezig}>
                    {bezig ? "Versturen..." : "Proefrit aanvragen"}
                  </button>
                </>
              )}

              {motorView === "verstuurd" && (
                <div style={{ textAlign:"center", padding:"12px 0 4px" }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
                  <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:20, marginBottom:6 }}>Proefrit aangevraagd!</div>
                  <div style={{ fontSize:14, color:T.muted, lineHeight:1.8 }}>We nemen contact op om de proefrit te bevestigen.</div>
                  <div style={{ fontSize:13, color:T.green, marginTop:6, fontWeight:600 }}>Gevraagde datum: {fmtDatum(f.datum)}</div>
                </div>
              )}

              {motorView === "aanbetaling" && (
                <>
                  <button onClick={() => setMotorView("detail")} style={{ background:"none", border:"none", color:T.accent, fontSize:13, cursor:"pointer", fontFamily:"Barlow, sans-serif", padding:"0 0 12px", display:"flex", alignItems:"center", gap:4 }}>
                    ← Terug naar details
                  </button>
                  <div style={{ background:`${T.accent}08`, border:`1px solid ${T.accent}30`, borderRadius:8, padding:16 }}>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:8 }}>Reserveer deze motor</div>
                    <div style={{ fontSize:13, color:T.text, lineHeight:1.7, marginBottom:8 }}>
                      Door een aanbetaling van <strong>€500</strong> te doen reserveert u deze motor. Het bedrag wordt verrekend bij aankoop.
                    </div>
                    <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>iDEAL betaling wordt binnenkort beschikbaar. Neem contact op om de aanbetaling te regelen.</div>
                    <button style={{ ...css.btn, marginTop:14 }} onClick={() => { setDetailMotor(null); if (onNaarContact) onNaarContact(); }}>Neem contact op</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {lichtbakFoto && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}
            onClick={() => setLichtbakFoto(null)}>
            <img src={clImg(lichtbakFoto, 1600)} alt="" style={{ maxWidth:"100%", maxHeight:"90vh", objectFit:"contain", borderRadius:4 }} />
            <button onClick={() => setLichtbakFoto(null)} style={{ position:"absolute", top:16, right:20, background:"none", border:"none", color:"#fff", fontSize:28, cursor:"pointer", lineHeight:1 }}>✕</button>
          </div>
        )}
      </>
    );
  };

  // ── Product detail modal ──
  const renderProductModal = () => {
    const prod = detailProduct;
    if (!prod) return null;
    const fotos = Array.isArray(prod.fotos) ? prod.fotos : [];
    return (
      <>
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
          onClick={e => { if (e.target === e.currentTarget) { setDetailProduct(null); setLichtbakFoto(null); }}}>
          <div style={{ background:T.surf, borderRadius:10, maxWidth:620, width:"100%", maxHeight:"90vh", overflowY:"auto", position:"relative" }}>
            <button onClick={() => setDetailProduct(null)} style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.55)", border:"none", color:"#fff", fontSize:18, cursor:"pointer", zIndex:2, lineHeight:1, width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            {fotos.length > 0 ? (
              <div style={{ display:"flex", gap:6, overflowX:"auto", padding:"16px 16px 6px" }}>
                {fotos.map((url, i) => (
                  <img key={i} src={clImg(url, 600)} alt=""
                    onClick={e => { e.stopPropagation(); setLichtbakFoto(url); }}
                    style={{ height:200, width:"auto", objectFit:"cover", borderRadius:8, flexShrink:0, cursor:"zoom-in", border:`1px solid ${T.border}` }} />
                ))}
              </div>
            ) : (
              <div style={{ height:140, background:T.surf2, borderRadius:"10px 10px 0 0", display:"flex", alignItems:"center", justifyContent:"center", color:T.muted, fontSize:13 }}>Geen foto's</div>
            )}
            {fotos.length > 1 && <div style={{ fontSize:11, color:T.muted, textAlign:"center", paddingTop:6 }}>Klik op een foto voor grotere weergave</div>}
            <div style={{ padding:"16px 20px 24px" }}>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:900, fontSize:24, marginBottom:4 }}>{prod.naam}</div>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:22, color:T.accent, marginBottom:14 }}>
                {prod.prijs != null ? `€${prod.prijs.toLocaleString()}` : "Op aanvraag"}
              </div>
              {prod.omschrijving && <div style={{ fontSize:14, color:T.text, lineHeight:1.7, marginBottom:14 }}>{prod.omschrijving}</div>}
              {productView === "detail" && !prod.verkocht_op && prod.actief !== false && (
                <button style={css.btn} onClick={() => setProductView("betalen")}>
                  Kopen — {prod.prijs ? `€ ${prod.prijs}` : "Prijs op aanvraag"}
                </button>
              )}
              {productView === "betalen" && (
                <>
                  <button onClick={() => setProductView("detail")} style={{ background:"none", border:"none", color:T.accent, fontSize:13, cursor:"pointer", fontFamily:"Barlow, sans-serif", padding:"0 0 12px", display:"flex", alignItems:"center", gap:4 }}>← Terug</button>
                  <div style={{ background:`${T.accent}08`, border:`1px solid ${T.accent}30`, borderRadius:8, padding:16 }}>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:8 }}>Betalen via iDEAL</div>
                    <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>iDEAL betaling wordt binnenkort beschikbaar. Neem contact op om dit product te reserveren.</div>
                    <button style={{ ...css.btn, marginTop:14 }} onClick={() => { setDetailProduct(null); if (onNaarContact) onNaarContact(); }}>Neem contact op</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {lichtbakFoto && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}
            onClick={() => setLichtbakFoto(null)}>
            <img src={clImg(lichtbakFoto, 1600)} alt="" style={{ maxWidth:"100%", maxHeight:"90vh", objectFit:"contain", borderRadius:4 }} />
            <button onClick={() => setLichtbakFoto(null)} style={{ position:"absolute", top:16, right:20, background:"none", border:"none", color:"#fff", fontSize:28, cursor:"pointer", lineHeight:1 }}>✕</button>
          </div>
        )}
      </>
    );
  };

  return (
    <div>
      {/* Sub-tab switcher */}
      <div style={{ display:"flex", gap:0, marginBottom:20, border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden", alignSelf:"flex-start", width:"fit-content" }}>
        {[["motoren","Motoren"],["onderdelen","Onderdelen"],["accessoires","Accessoires"]].map(([id,label]) => (
          <button key={id} onClick={() => setSubTab(id)}
            style={{ padding:"9px 20px", background:subTab===id?T.accent:"transparent", color:subTab===id?"#fff":T.muted, border:"none", borderRight:id!=="accessoires"?`1px solid ${T.border}`:"none", cursor:"pointer", fontFamily:"Barlow, sans-serif", fontWeight:subTab===id?600:400, fontSize:13, transition:"background 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      {subTab === "motoren" && (
        voorraad.length === 0
          ? <div style={{ color:T.muted, fontSize:13, textAlign:"center", marginTop:60 }}>Geen motors in de showroom</div>
          : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 }}>
              {voorraad.map(m => renderMotorCard(m))}
            </div>
      )}

      {(subTab === "onderdelen" || subTab === "accessoires") && (() => {
        const list = producten.filter(p => p.categorie === subTab);
        return list.length === 0
          ? <div style={{ color:T.muted, fontSize:13, textAlign:"center", marginTop:60 }}>Geen {subTab} beschikbaar</div>
          : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14 }}>
              {list.map(p => renderProductCard(p))}
            </div>;
      })()}

      {detailMotor && renderMotorModal()}
      {detailProduct && !detailMotor && renderProductModal()}
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────
export default function KlantApp({ userId }) {
  const [themeMode, setThemeMode] = useState(() => { try { return localStorage.getItem("djm_klant_theme") || "automatisch" } catch { return "automatisch" } });
  const [sysDark, setSysDark] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = e => setSysDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  const setTheme = (mode) => { setThemeMode(mode); try { localStorage.setItem("djm_klant_theme", mode) } catch {} };
  const effectiveDark = themeMode === "donker" || (themeMode === "automatisch" && sysDark);
  Object.assign(T, effectiveDark ? T_DARK : T_LIGHT);
  const [tab, setTab] = useState("motor");
  const [klant, setKlant] = useState(null);
  const [motoren, setMotoren] = useState([]);
  const [selMotorId, setSelMotorId] = useState(() => sessionStorage.getItem("djm_sel_motor"));
  const [hoofdMotorId, setHoofdMotorId] = useState(() => localStorage.getItem("djm_hoofd_motor"));
  const [bezetteDagen, setBezetteDagen] = useState([]);
  const [geslotenDagen, setGeslotenDagen] = useState([]);
  const [openingstijden, setOpeningstijden] = useState(null);
  const [opmerking, setOpmerking] = useState("");
  const [dienstenTarieven, setDienstenTarieven] = useState({});
  const [afspraakSoorten, setAfspraakSoorten] = useState([]);
  const [voorraad, setVooraad] = useState([]);
  const [producten, setProducten] = useState([]);
  const [eigenAfspraken, setEigenAfspraken] = useState([]);
  const [bevestigingMelding, setBevestigingMelding] = useState(null);
  const [laden, setLaden] = useState(true);

  const [autoOpenMotorForm, setAutoOpenMotorForm] = useState(false);

  const kiesMotor = (id) => { sessionStorage.setItem("djm_sel_motor", id); setSelMotorId(id); };
  const kiesHoofdMotor = (id) => { localStorage.setItem("djm_hoofd_motor", id); setHoofdMotorId(id); kiesMotor(id); };

  const naarMotorToevoegen = () => { setAutoOpenMotorForm(true); setTab("instellingen"); };

  const gesorteerdMotoren = hoofdMotorId
    ? [...motoren].sort((a, b) => a.id === hoofdMotorId ? -1 : b.id === hoofdMotorId ? 1 : 0)
    : motoren;

  useEffect(() => {
    const timer = setTimeout(() => setLaden(false), 12000);
    const laadData = async () => {
      try {
        // Klant, instellingen, afspraken en huidige user parallel ophalen
        const [klantRes, afsprakenRes, instRes, userRes] = await Promise.all([
          supabase.from("klanten").select("*").eq("user_id", userId).single(),
          supabase.rpc("get_bezette_dagen"),
          supabase.from("instellingen").select("gesloten_dagen,openingstijden,opmerking,diensten_tarieven,afspraak_soorten").single(),
          supabase.auth.getUser(),
        ]);

        let klantData = klantRes.data;

        // Niet gevonden op user_id → probeer email-koppeling (admin pre-aangemaakt)
        if (!klantData) {
          const email = userRes.data?.user?.email;
          if (email) {
            const { data: klantByEmail } = await supabase
              .from("klanten").select("*").eq("email", email).is("user_id", null).single();
            if (klantByEmail) {
              await supabase.from("klanten").update({ user_id: userId }).eq("id", klantByEmail.id);
              klantData = { ...klantByEmail, user_id: userId };
            }
          }
        }

        if (!klantData) { setLaden(false); clearTimeout(timer); return; }
        setKlant(klantData);

        // Eigen afspraken ophalen (voor status-weergave in de app)
        const { data: eigenAfsData } = await supabase
          .from("afspraken")
          .select("id,datum,status,soort,type,tijd,duur,naam,voorraad_motor_id")
          .eq("klant_id", klantData.id)
          .order("datum");
        setEigenAfspraken(eigenAfsData || []);

        // Instellingen direct verwerken
        const inst = instRes.data;
        const gesloten = inst?.gesloten_dagen || [];
        setGeslotenDagen(gesloten);
        setBezetteDagen([...(afsprakenRes.data||[]).map(a => String(a.datum)), ...gesloten]);
        if (inst?.openingstijden) setOpeningstijden(inst.openingstijden);
        if (inst?.opmerking !== undefined) setOpmerking(inst.opmerking || "");
        if (inst?.diensten_tarieven) setDienstenTarieven(inst.diensten_tarieven);
        if (inst?.afspraak_soorten?.length) setAfspraakSoorten(inst.afspraak_soorten);

        // Motoren ophalen (heeft klant_id nodig)
        const { data: motorenData } = await supabase
          .from("motoren").select("*").eq("klant_id", klantData.id);
        const motorIds = (motorenData||[]).map(m => m.id);

        if (motorIds.length > 0) {
          const [{ data: kmData }, { data: svcData }] = await Promise.all([
            supabase.from("km_historie").select("*").in("motor_id", motorIds).order("datum"),
            supabase.from("service_beurten").select("*").in("motor_id", motorIds).order("datum", { ascending: false }),
          ]);
          setMotoren((motorenData||[]).map(m => ({
            ...m,
            kmHistory: (kmData||[]).filter(k => k.motor_id === m.id).map(k => ({ datum: k.datum, km: k.km })),
            service: (svcData||[]).filter(s => s.motor_id === m.id),
          })));
          const storedSel = sessionStorage.getItem("djm_sel_motor");
          const storedHoofd = localStorage.getItem("djm_hoofd_motor");
          setSelMotorId(motorIds.includes(storedSel) ? storedSel : motorIds.includes(storedHoofd) ? storedHoofd : motorIds[0]);
        } else {
          setMotoren([]);
        }

        // Voorraad ophalen (incl. recent verkochte motors, 30 dagen zichtbaar)
        const { data: vData } = await supabase
          .from("voorraad")
          .select("id,merk,model,bouwjaar,km,prijs,fotos,kenteken,status,datum_in,verkocht_op,fotos_bewaren_tot,voorband_datum,achterband_datum")
          .neq("status", "verwijderd")
          .or(`verkocht_op.is.null,fotos_bewaren_tot.gt.${TODAY},verkocht_op.gte.${new Date(Date.now()-30*86400000).toISOString().split("T")[0]}`)
          .order("created_at", { ascending: false });
        setVooraad((vData || []).filter(m => m.verkocht_op ? true : m.status !== "niet_beschikbaar"));

        // Producten ophalen (onderdelen + accessoires)
        const { data: pData } = await supabase
          .from("producten")
          .select("id,naam,omschrijving,prijs,fotos,categorie")
          .eq("actief", true)
          .order("created_at", { ascending: false });
        setProducten(pData || []);
      } catch(e) { console.error(e); }
      setLaden(false);
      clearTimeout(timer);
    };
    laadData();
    return () => clearTimeout(timer);
  }, [userId]);

  // Realtime: eigen afspraken — status-updates (admin bevestigt / werkt af)
  useEffect(() => {
    if (!klant?.id) return;
    const sub = supabase.channel("klant-eigen-afspraken")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "afspraken", filter: `klant_id=eq.${klant.id}` }, ({ new: n }) => {
        setEigenAfspraken(prev => prev.map(a => a.id === n.id ? { ...a, ...n } : a));
        if (n.status === "gepland") {
          const datumStr = n.datum ? new Date(n.datum + "T00:00:00").toLocaleDateString("nl-NL", { weekday:"long", day:"numeric", month:"long" }) : n.datum;
          setBevestigingMelding(`Uw afspraak op ${datumStr} is bevestigd!`);
          setTimeout(() => setBevestigingMelding(null), 7000);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "afspraken", filter: `klant_id=eq.${klant.id}` }, ({ new: n }) => {
        setEigenAfspraken(prev => [...prev, n].sort((a, b) => (a.datum||"").localeCompare(b.datum||"")));
      })
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [klant?.id]);

  const slaKmOp = async (motorId, km) => {
    const { error } = await supabase.from("km_historie").insert({ motor_id: motorId, km, datum: TODAY });
    if (error) { console.error("Km opslaan mislukt:", error); return; }
    setMotoren(prev => prev.map(m => m.id === motorId
      ? { ...m, kmHistory: [...m.kmHistory, { datum: TODAY, km }] } : m
    ));
  };

  const slaAfspraakOp = async (f) => {
    const motor = motoren.find(m => m.id === f.motorId);
    await supabase.from("afspraken").insert({
      klant_id: klant.id, motor_id: motor?.id || null,
      datum: f.datum, opmerking: f.opmerking || "", status: "aangevraagd",
      type: "service", soort: f.soort || null, duur: f.duur || 1,
      naam: klant.naam || null, telefoon: klant.telefoon || null, email: klant.email || null,
    });
    setBezetteDagen(prev => [...prev, f.datum]);
  };

  const slaProefritAanvraagOp = async (f) => {
    await supabase.from("afspraken").insert({
      klant_id: klant.id,
      voorraad_motor_id: f.voorraadMotorId,
      datum: f.datum,
      naam: f.naam || klant.naam,
      telefoon: f.telefoon || klant.telefoon || null,
      email: f.email || klant.email || null,
      opmerking: f.opmerking || "",
      status: "aangevraagd",
      type: "proefrit",
      duur: 1,
    });
  };

  const updateKlantProfiel = async (data) => {
    const { error } = await supabase.from("klanten").update(data).eq("id", klant.id);
    if (error) return error.message;
    setKlant(prev => ({ ...prev, ...data }));
    return null;
  };

  const wijzigWachtwoord = async (nieuwWachtwoord) => {
    const { error } = await supabase.auth.updateUser({ password: nieuwWachtwoord });
    if (error) return error.message;
    return null;
  };

  const voegMotorToeVanKlant = async (data) => {
    const { data: nieuw, error } = await supabase.from("motoren").insert({
      klant_id: klant.id,
      merk: data.merk, model: data.model, kenteken: data.kenteken,
      bouwjaar: data.bouwjaar ? parseInt(data.bouwjaar) : null,
      aankoopdatum: data.aankoopdatum || null,
    }).select().single();
    if (error) return error.message;
    if (nieuw && data.beginkm && parseInt(data.beginkm) > 0) {
      await supabase.from("km_historie").insert({
        motor_id: nieuw.id, km: parseInt(data.beginkm),
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
    await supabase.from("km_historie").delete().eq("motor_id", motorId);
    const { error } = await supabase.from("motoren").delete().eq("id", motorId);
    if (error) return "Verwijderen mislukt. Neem contact op als de motor servicehistorie heeft.";
    setMotoren(prev => prev.filter(m => m.id !== motorId));
    return null;
  };

  const updateMotorBanden = async (motorId, data) => {
    const { error } = await supabase.from("motoren").update(data).eq("id", motorId);
    if (!error) setMotoren(prev => prev.map(m => m.id===motorId ? {...m,...data} : m));
    return error?.message || null;
  };

  const voegEigenServiceToe = async (motorId, data) => {
    const km = data.km ? parseInt(data.km) : null;
    const intervalGereset = data.interval_gereset || false;
    const { data: inserted, error } = await supabase.from("service_beurten").insert({
      motor_id: motorId,
      datum: data.datum,
      omschrijving: data.omschrijving,
      km,
      klant_invoer: true,
      interval_gereset: intervalGereset,
    }).select().single();
    if (error) return error.message;
    if (km) await supabase.from("km_historie").insert({ motor_id: motorId, km, datum: data.datum });
    if (intervalGereset && km) await supabase.from("motoren").update({ last_service_km: km }).eq("id", motorId);
    setMotoren(prev => prev.map(m => {
      if (m.id !== motorId) return m;
      const nieuweService = [...(m.service || []), inserted];
      const nieuweKm = km ? [...(m.kmHistory || []), { datum: data.datum, km }] : m.kmHistory;
      return { ...m, service: nieuweService, kmHistory: nieuweKm, last_service_km: (intervalGereset && km) ? km : m.last_service_km };
    }));
    return null;
  };

  const wijzigEigenService = async (motorId, svcId, data) => {
    const km = data.km ? parseInt(data.km) : null;
    const { error } = await supabase.from("service_beurten").update({
      datum: data.datum,
      omschrijving: data.omschrijving,
      km,
      interval_gereset: data.interval_gereset || false,
    }).eq("id", svcId);
    if (error) return error.message;
    if (data.interval_gereset && km) await supabase.from("motoren").update({ last_service_km: km }).eq("id", motorId);
    setMotoren(prev => prev.map(m => {
      if (m.id !== motorId) return m;
      return {
        ...m,
        service: m.service.map(sv => sv.id === svcId ? { ...sv, datum: data.datum, omschrijving: data.omschrijving, km, interval_gereset: data.interval_gereset || false } : sv),
        last_service_km: (data.interval_gereset && km) ? km : m.last_service_km,
      };
    }));
    return null;
  };

  const verzendDienstAanvraag = async (soort, data) => {
    const { datum, motor_id, opmerking: opm, ...extra } = data;
    const lines = [];
    if (extra.locatie) lines.push(`Locatie: ${extra.locatie}`);
    if (extra.advertentie_url) lines.push(`Advertentie: ${extra.advertentie_url}`);
    if (extra.merk) lines.push(`Merk: ${extra.merk}`);
    if (extra.model) lines.push(`Model: ${extra.model}`);
    if (extra.bouwjaar) lines.push(`Bouwjaar v.a.: ${extra.bouwjaar}`);
    if (extra.km) lines.push(`Max km-stand: ${extra.km}`);
    if (extra.budget) lines.push(`Budget: € ${extra.budget}`);
    if (extra.extra_opties) lines.push(`Opties: ${extra.extra_opties}`);
    if (extra.min_prijs) lines.push(`Minimale prijs: € ${extra.min_prijs}`);
    if (extra.fotos && extra.fotos.length > 0) lines.push(`Foto's:\n${extra.fotos.map((u, i) => `  ${i + 1}. ${u}`).join("\n")}`);
    const fullOpmerking = [opm, ...lines].filter(Boolean).join("\n");
    const { error } = await supabase.from("afspraken").insert({
      klant_id: klant.id,
      motor_id: motor_id || null,
      datum: datum || TODAY,
      naam: klant.naam,
      telefoon: klant.telefoon || null,
      email: klant.email || null,
      opmerking: fullOpmerking || "",
      status: "aangevraagd",
      type: soort,
      duur: 1,
    });
    if (error) return error.message;
    if (datum) setBezetteDagen(prev => [...prev, datum]);
    return null;
  };

  const nav = [
    { id: "motor",    icon: "◧", label: "Motor"    },
    { id: "service",  icon: "◉", label: "Service"  },
    { id: "km",       icon: "◈", label: "Km Stand" },
    { id: "voorraad", icon: "◫", label: "Voorraad" },
    { id: "contact",  icon: "◎", label: "Contact"  },
  ];
  const titles = { motor: "Mijn Motor", service: "Service & Afspraken", km: "Km Stand", voorraad: "Voorraad", contact: "Contact", instellingen: "Instellingen" };

  const isMobile = useIsMobile();

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
        <div style={{ fontSize:36, margin:"20px 0 12px" }}>⏳</div>
        <div style={{ fontSize:16, fontWeight:600, color:T.text, marginBottom:10 }}>Wacht op goedkeuring</div>
        <div style={{ fontSize:13, color:T.muted, lineHeight:1.8, maxWidth:280, margin:"0 auto" }}>
          Je e-mailadres staat nog niet in ons systeem. De Jonge Motoren voegt je zo snel mogelijk toe.
        </div>
        <button onClick={uitloggen}
          style={{ marginTop:24, padding:"10px 20px", background:"transparent", border:`1px solid ${T.border}`, color:T.muted, borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"Barlow, sans-serif" }}>
          Uitloggen
        </button>
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
        <button onClick={uitloggen}
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

  // Desktop layout
  if (!isMobile) {
    return (
      <div style={{ display:"flex", height:"100dvh", background:T.bg, fontFamily:"Barlow, sans-serif", color:T.text, overflow:"hidden" }}>
        {bevestigingMelding && (
          <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", background:T.green, color:"#fff", padding:"12px 24px", borderRadius:10, zIndex:9999, fontSize:14, fontWeight:600, boxShadow:"0 4px 16px rgba(0,0,0,0.25)", whiteSpace:"nowrap", fontFamily:"Barlow, sans-serif" }}>
            ✓ {bevestigingMelding}
          </div>
        )}
        {/* Zijbalk */}
        <div style={{ width:220, background:T.surf, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
          {/* Logo */}
          <div style={{ padding:"24px 20px 20px", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:900, fontSize:20, letterSpacing:2, color:T.text, lineHeight:1 }}>DE JONGE</div>
            <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:600, fontSize:11, letterSpacing:5, color:T.accent, marginTop:3 }}>MOTOREN</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:8, fontWeight:500 }}>Mijn Garage</div>
          </div>
          {/* Klant info */}
          <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{klant.naam?.split(" ")[0] || klant.naam}</div>
            <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{motoren.length} motor{motoren.length!==1?"en":""}</div>
          </div>
          {/* Navigatie */}
          <div style={{ flex:1, paddingTop:8 }}>
            {nav.map(n=>(
              <button key={n.id} onClick={()=>setTab(n.id)}
                style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"12px 20px", background:tab===n.id?`${T.accent}15`:"transparent", border:"none", borderLeft:tab===n.id?`3px solid ${T.accent}`:"3px solid transparent", color:tab===n.id?T.accent:T.muted, cursor:"pointer", fontFamily:"Barlow, sans-serif", fontSize:14, fontWeight:tab===n.id?600:400, boxSizing:"border-box", textAlign:"left" }}>
                <span style={{fontSize:18,lineHeight:1}}>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>
          {/* Instellingen + uitloggen */}
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:4, paddingBottom:12 }}>
            <button onClick={()=>setTab(tab==="instellingen"?"motor":"instellingen")}
              style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"12px 20px", background:tab==="instellingen"?`${T.accent}15`:"transparent", border:"none", borderLeft:tab==="instellingen"?`3px solid ${T.accent}`:"3px solid transparent", color:tab==="instellingen"?T.accent:T.muted, cursor:"pointer", fontFamily:"Barlow, sans-serif", fontSize:14, fontWeight:tab==="instellingen"?600:400, boxSizing:"border-box", textAlign:"left" }}>
              <GearIcon size={16}/> Instellingen
            </button>
            <button onClick={uitloggen}
              style={{ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"12px 20px", background:"transparent", border:"none", borderLeft:"3px solid transparent", color:T.muted, cursor:"pointer", fontFamily:"Barlow, sans-serif", fontSize:14, boxSizing:"border-box", textAlign:"left" }}>
              <span style={{fontSize:16,lineHeight:1}}>↪</span> Uitloggen
            </button>
          </div>
        </div>

        {/* Hoofdinhoud */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* Header */}
          <div style={{ padding:"18px 32px", borderBottom:`1px solid ${T.border}`, flexShrink:0, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:28, letterSpacing:0.5 }}>
              {titles[tab] || titles.motor}
            </div>
          </div>
          {/* Scrollbaar content */}
          <div style={{ flex:1, overflowY:"auto", padding:"24px 32px 32px" }}>
            {tab === "motor" && <MijnMotor motoren={gesorteerdMotoren} selMotorId={selMotorId} onSelMotor={kiesMotor} onVoegServiceToe={voegEigenServiceToe} onNaarInstellingen={naarMotorToevoegen}/>}
            {tab === "service" && <ServiceTab motoren={gesorteerdMotoren} selMotorId={selMotorId} onSelMotor={kiesMotor} bezetteDagen={bezetteDagen} geslotenDagen={geslotenDagen} openingstijden={openingstijden} onSlaAfspraakOp={slaAfspraakOp} onWijzigService={wijzigEigenService} afspraakSoorten={afspraakSoorten} eigenAfspraken={eigenAfspraken}/>}
            {tab === "km" && <KmStand motoren={gesorteerdMotoren} selMotorId={selMotorId} onSelMotor={kiesMotor} onSlaOp={slaKmOp}/>}
            {tab === "voorraad" && <VoorraadTab voorraad={voorraad} producten={producten} klant={klant} geslotenDagen={geslotenDagen} openingstijden={openingstijden} onSlaProefritOp={slaProefritAanvraagOp} onNaarContact={() => setTab("contact")}/>}
            {tab === "contact" && <Contact openingstijden={openingstijden} geslotenDagen={geslotenDagen} bezetteDagen={bezetteDagen} opmerking={opmerking} klant={klant} motoren={gesorteerdMotoren} dienstenTarieven={dienstenTarieven} onVerzendAanvraag={verzendDienstAanvraag}/>}
            {tab === "instellingen" && (
              <Instellingen
                klant={klant} motoren={gesorteerdMotoren}
                hoofdMotorId={hoofdMotorId}
                onKiesHoofd={kiesHoofdMotor}
                onUpdateKlant={updateKlantProfiel}
                onVoegMotorToe={voegMotorToeVanKlant}
                onVerwijderMotor={verwijderMotor}
                onWijzigWachtwoord={wijzigWachtwoord}
                onUpdateBanden={updateMotorBanden}
                themeMode={themeMode}
                onThemeMode={setTheme}
                autoOpenMotorForm={autoOpenMotorForm}
                onMotorFormOpened={() => setAutoOpenMotorForm(false)}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Mobiele layout (ongewijzigd)
  return (
    <div style={css.app}>
      {bevestigingMelding && (
        <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:T.green, color:"#fff", padding:"12px 20px", borderRadius:10, zIndex:9999, fontSize:14, fontWeight:600, boxShadow:"0 4px 16px rgba(0,0,0,0.25)", maxWidth:320, width:"calc(100% - 40px)", textAlign:"center", fontFamily:"Barlow, sans-serif" }}>
          ✓ {bevestigingMelding}
        </div>
      )}
      <div style={css.topBar}>
        <div style={css.logoWrap}>
          <div style={css.logoTop}>DE JONGE MOTOREN</div>
          <div style={css.logoSub}>MIJN GARAGE</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{klant.naam?.split(" ")[0] || klant.naam}</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{motoren.length} motor{motoren.length !== 1 ? "en" : ""}</div>
          </div>
          <button onClick={() => setTab(tab === "instellingen" ? "motor" : "instellingen")}
            style={{ width: 34, height: 34, borderRadius: "50%", background: tab === "instellingen" ? T.accent : T.surf2, border: `1px solid ${tab === "instellingen" ? T.accent : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: tab === "instellingen" ? "#fff" : T.muted }}
            title="Instellingen">
            <GearIcon size={16} />
          </button>
        </div>
      </div>

      <div style={{ padding: "14px 20px 0" }}>
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: 0.5 }}>
          {titles[tab] || titles.motor}
        </div>
      </div>

      <div style={css.scroll}>
        {tab === "motor" && <MijnMotor motoren={gesorteerdMotoren} selMotorId={selMotorId} onSelMotor={kiesMotor} onVoegServiceToe={voegEigenServiceToe} onNaarInstellingen={naarMotorToevoegen}/>}
        {tab === "service" && <ServiceTab motoren={gesorteerdMotoren} selMotorId={selMotorId} onSelMotor={kiesMotor} bezetteDagen={bezetteDagen} geslotenDagen={geslotenDagen} openingstijden={openingstijden} onSlaAfspraakOp={slaAfspraakOp} onWijzigService={wijzigEigenService} afspraakSoorten={afspraakSoorten} eigenAfspraken={eigenAfspraken}/>}
        {tab === "km" && <KmStand motoren={gesorteerdMotoren} selMotorId={selMotorId} onSelMotor={kiesMotor} onSlaOp={slaKmOp}/>}
        {tab === "voorraad" && <VoorraadTab voorraad={voorraad} producten={producten} klant={klant} geslotenDagen={geslotenDagen} openingstijden={openingstijden} onSlaProefritOp={slaProefritAanvraagOp} onNaarContact={() => setTab("contact")}/>}
        {tab === "contact" && <Contact openingstijden={openingstijden} geslotenDagen={geslotenDagen} bezetteDagen={bezetteDagen} opmerking={opmerking} klant={klant} motoren={gesorteerdMotoren} dienstenTarieven={dienstenTarieven} onVerzendAanvraag={verzendDienstAanvraag}/>}
        {tab === "instellingen" && (
          <Instellingen
            klant={klant} motoren={gesorteerdMotoren}
            hoofdMotorId={hoofdMotorId}
            onKiesHoofd={kiesHoofdMotor}
            onUpdateKlant={updateKlantProfiel}
            onVoegMotorToe={voegMotorToeVanKlant}
            onVerwijderMotor={verwijderMotor}
            onWijzigWachtwoord={wijzigWachtwoord}
            onUpdateBanden={updateMotorBanden}
          />
        )}
      </div>

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
