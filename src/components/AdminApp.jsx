import { useState, useEffect } from "react";

// Detecteer mobiel — wordt door alle componenten gebruikt
const useIsMobile = () => {
  const [mob, setMob] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setMob(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mob;
};

const T = {
  bg: "#F8F8F8", surf: "#FFFFFF", surf2: "#F2F2F2", border: "#E0E0E0",
  accent: "#E31E24", text: "#1A1A1A", muted: "#767676",
  green: "#16A34A", yellow: "#D97706", red: "#DC2626",
};

const s = {
  app: { display:"flex", height:"100dvh", background:T.bg, fontFamily:"Barlow, sans-serif", color:T.text, overflow:"hidden" },
  sidebar: { width:220, background:T.surf, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", flexShrink:0 },
  logo: { padding:"24px 20px 20px", borderBottom:`1px solid ${T.border}` },
  logoTop: { fontFamily:"Barlow Condensed, sans-serif", fontWeight:900, fontSize:22, letterSpacing:2, color:T.text },
  logoSub: { fontFamily:"Barlow Condensed, sans-serif", fontWeight:600, fontSize:13, letterSpacing:4, color:T.accent, marginTop:2 },
  navItem: (a) => ({ display:"flex", alignItems:"center", gap:10, padding:"12px 20px", cursor:"pointer", fontSize:14, fontWeight: a?600:400, color: a?T.accent:T.muted, background: a?`${T.accent}15`:"transparent", borderLeft: a?`3px solid ${T.accent}`:"3px solid transparent", transition:"all 0.15s" }),
  main: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  header: { padding:"18px 28px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 },
  headerTitle: { fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:26, letterSpacing:1 },
  content: { flex:1, overflowY:"auto", padding:"22px 28px" },
  card: { background:T.surf, border:`1px solid ${T.border}`, borderRadius:6, padding:20 },
  statCard: { background:T.surf, border:`1px solid ${T.border}`, borderRadius:6, padding:20, flex:1 },
  statNum: { fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:42, color:T.accent, lineHeight:1 },
  statLabel: { fontSize:11, color:T.muted, marginTop:5, letterSpacing:1, textTransform:"uppercase" },
  btn: { padding:"9px 16px", background:T.accent, color:"#fff", border:"none", borderRadius:4, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"Barlow, sans-serif", whiteSpace:"nowrap" },
  btnGhost: { padding:"9px 16px", background:"transparent", color:T.muted, border:`1px solid ${T.border}`, borderRadius:4, fontSize:13, cursor:"pointer", fontFamily:"Barlow, sans-serif", whiteSpace:"nowrap" },
  btnOutline: { padding:"9px 16px", background:"transparent", color:T.accent, border:`1px solid ${T.accent}`, borderRadius:4, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"Barlow, sans-serif", whiteSpace:"nowrap" },
  input: { background:T.surf2, border:`1px solid ${T.border}`, borderRadius:4, padding:"9px 12px", color:T.text, fontSize:14, fontFamily:"Barlow, sans-serif", outline:"none", width:"100%", boxSizing:"border-box" },
  label: { fontSize:11, color:T.muted, marginBottom:5, letterSpacing:0.5, display:"block", textTransform:"uppercase" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 },
  modal: { background:T.surf, border:`1px solid ${T.border}`, borderRadius:8, padding:28, width:"100%", maxWidth:520, maxHeight:"88vh", overflowY:"auto" },
  modalTitle: { fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:22, marginBottom:20 },
  badge: (c) => ({ display:"inline-block", padding:"2px 8px", borderRadius:3, fontSize:11, fontWeight:600, background:`${c}20`, color:c }),
  sectionLabel: { fontSize:11, color:T.accent, letterSpacing:2, marginBottom:14, textTransform:"uppercase" },
};

// ── Utils ───────────────────────────────────────────────────────────────────
const timeToMin = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const minToTime = m => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const WSTART = 540; const WEND = 1020; // 09:00 - 17:00
const MIDI_MIN = 780; // 13:00 — middag begint na lunch (12-13)
const TODAY = new Date().toISOString().split("T")[0];
const DAYS_NL = ["Ma","Di","Wo","Do","Vr","Za"];
const fmtDate = d => { const [,mm,dd]=d.split("-"); return `${dd}/${mm}`; };

// ── Cloudinary ──────────────────────────────────────────────────────────────
const CL_CLOUD = "dkfdwnep4";
const CL_PRESET = "Djm app";

const uploadFoto = async (file) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CL_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CL_CLOUD}/image/upload`, {
    method: "POST", body: fd,
  });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  return data.secure_url;
};

const clImg = (url, w=800) => url ? url.replace("/upload/", `/upload/c_scale,w_${w},q_auto:eco,f_auto/`) : url;

// ── Band-utils ──────────────────────────────────────────────────────────────
const getWeekNr = (d) => {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
};

const bandLeeftijd = (datumStr) => {
  if(!datumStr) return null;
  const [w, y] = datumStr.split("/").map(Number);
  if(!w || !y || w < 1 || w > 53 || y < 1990) return null;
  const now = new Date();
  return (now.getFullYear() - y) + (getWeekNr(now) - w) / 52;
};

const bandStatus = (jaren) => {
  if(jaren === null) return null;
  if(jaren >= 10) return { kleur: T.red,    icon: "✕", label: "vervangen!" };
  if(jaren >= 8)  return { kleur: T.red,    icon: "⚠", label: `${jaren.toFixed(1)} jr` };
  if(jaren >= 5)  return { kleur: T.yellow,  icon: "⚠", label: `${jaren.toFixed(1)} jr` };
  return               { kleur: T.green,   icon: "✓", label: `${jaren.toFixed(1)} jr` };
};

const getWeekDates = base => {
  const d = new Date(base); const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate()-(day===0?6:day-1));
  return Array.from({length:6},(_,i)=>{ const x=new Date(mon); x.setDate(mon.getDate()+i); return x.toISOString().split("T")[0]; });
};

const getSlots = (afspraken, datum, duurUur) => {
  const dur = duurUur*60;
  const busy = afspraken.filter(a=>a.datum===datum && a.tijd)
    .map(a=>({s:timeToMin(a.tijd),e:timeToMin(a.tijd)+(parseInt(a.duur)||1)*60}))
    .sort((a,b)=>a.s-b.s);
  const slots=[]; let cur=WSTART;
  for(const b of busy){ let t=cur; while(t+dur<=b.s){slots.push(minToTime(t));t+=30;} cur=Math.max(cur,b.e); }
  let t=cur; while(t+dur<=WEND){slots.push(minToTime(t));t+=30;}
  return slots;
};

const getProefritSlots = (afspraken, datum) => {
  const pr = afspraken.filter(a => a.datum===datum && a.type==="proefrit" && a.tijd);
  const oBezet = pr.some(a => timeToMin(a.tijd) < MIDI_MIN);
  const mBezet = pr.some(a => timeToMin(a.tijd) >= MIDI_MIN);
  const slots = [];
  if(!oBezet) for(let t=WSTART; t<660; t+=30) slots.push(minToTime(t));       // 09:00–10:30
  if(!mBezet) for(let t=MIDI_MIN; t+60<=WEND-60; t+=30) slots.push(minToTime(t)); // 13:00–15:00
  return slots;
};

// ── Shared UI ────────────────────────────────────────────────────────────────
function Modal({title,onClose,children}){
  const mob=useIsMobile();
  const overlayStyle=mob
    ?{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",flexDirection:"column",zIndex:100}
    :s.overlay;
  const modalStyle=mob
    ?{flex:1,background:T.surf,padding:"16px 16px 80px",overflowY:"auto",width:"100%"}
    :s.modal;
  return(
    <div style={overlayStyle} onClick={e=>!mob&&e.target===e.currentTarget&&onClose()}>
      <div style={modalStyle}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={s.modalTitle}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:T.muted,fontSize:22,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({label,children}){
  return <div style={{marginBottom:14}}><label style={s.label}>{label}</label>{children}</div>;
}

function Grid2({children}){
  const mob=useIsMobile();
  return <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:10}}>{children}</div>;
}

function ModalFooter({onClose,label="Opslaan",onClick}){
  return(
    <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
      <button style={s.btnGhost} onClick={onClose}>Annuleer</button>
      <button style={s.btn} onClick={onClick}>{label}</button>
    </div>
  );
}

// ── Modals ───────────────────────────────────────────────────────────────────

function UitnodigingModal({klant, onClose}){
  const [stap, setStap] = useState("keuze");
  const [gekopieerd, setGekopieerd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const inviteLink = `${window.location.origin}`;
  const whatsappTekst = `Hallo ${klant.naam.split(' ')[0]}! 👋\n\nBij De Jonge Motoren kunt u uw motorgegevens en servicehistorie inzien via onze app.\n\n📱 Ga naar: ${window.location.origin}\n\nMaak een account aan met uw e-mailadres: ${klant.email}\n\nTot ziens!`;

  const stuurEmail = async () => {
    setBezig(true);
    try {
      const { stuurUitnodiging } = await import("../lib/supabase.js");
      await stuurUitnodiging(klant.email);
      setStap("email_verzonden");
    } catch(e) {
      alert("Fout bij versturen: " + e.message);
    }
    setBezig(false);
  };

  const kopieer = () => {
    navigator.clipboard.writeText(inviteLink).then(()=>{
      setGekopieerd(true);
      setTimeout(()=>setGekopieerd(false), 2500);
    });
  };

  return(
    <Modal title="KLANT UITNODIGEN" onClose={onClose}>
      {stap==="keuze"&&(
        <>
          <div style={{padding:"14px 16px",background:T.surf2,borderRadius:5,marginBottom:20}}>
            <div style={{fontSize:14,fontWeight:500}}>{klant.naam}</div>
            <div style={{fontSize:12,color:T.muted,marginTop:3}}>{klant.email}</div>
          </div>
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Hoe wil je de uitnodiging versturen?</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button style={{...s.btn,width:"100%",padding:"12px 16px",textAlign:"left",display:"flex",alignItems:"center",gap:10}}
              onClick={stuurEmail} disabled={bezig}>
              <span style={{fontSize:16}}>✉</span>
              <div>
                <div>{bezig ? "Versturen..." : "Stuur via e-mail"}</div>
                <div style={{fontSize:11,opacity:0.7,fontWeight:400,marginTop:1}}>Klant ontvangt een inloglink op {klant.email}</div>
              </div>
            </button>
            <button style={{...s.btnOutline,width:"100%",padding:"12px 16px",textAlign:"left",display:"flex",alignItems:"center",gap:10}}
              onClick={()=>setStap("link")}>
              <span style={{fontSize:16}}>🔗</span>
              <div>
                <div>WhatsApp bericht</div>
                <div style={{fontSize:11,opacity:0.7,fontWeight:400,marginTop:1}}>Klaar om te versturen via WhatsApp</div>
              </div>
            </button>
          </div>
          <div style={{marginTop:16,textAlign:"center"}}>
            <button style={{background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif"}} onClick={onClose}>
              Niet nu
            </button>
          </div>
        </>
      )}
      {stap==="email_verzonden"&&(
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <div style={{fontSize:36,marginBottom:12}}>✅</div>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8}}>E-mail verstuurd!</div>
          <div style={{fontSize:13,color:T.muted,lineHeight:1.6}}>
            {klant.naam} krijgt een e-mail op<br/>
            <span style={{color:T.text}}>{klant.email}</span><br/>
            met een directe inloglink.
          </div>
          <button style={{...s.btn,marginTop:20}} onClick={onClose}>Sluiten</button>
        </div>
      )}
      {stap==="link"&&(
        <div>
          <div style={{fontSize:13,color:T.muted,marginBottom:12}}>Dit bericht wordt verstuurd via WhatsApp:</div>
          <div style={{background:T.surf2,border:`1px solid ${T.border}`,borderRadius:4,padding:"12px 14px",fontSize:13,lineHeight:1.8,marginBottom:14,whiteSpace:"pre-wrap",color:T.text}}>
            {whatsappTekst}
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent(whatsappTekst)}`} target="_blank" rel="noopener noreferrer"
            style={{display:"block",padding:13,background:"#25D366",color:"#fff",borderRadius:8,fontSize:15,fontWeight:600,textAlign:"center",textDecoration:"none",fontFamily:"Barlow, sans-serif"}}>
            📱 Openen in WhatsApp
          </a>
          <div style={{marginTop:12,textAlign:"center"}}>
            <button style={{background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif"}} onClick={onClose}>
              Sluiten
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function KlantModal({onSave, onClose, voorraad=[]}){
  const [f,setF]=useState({naam:"",email:"",telefoon:"",adres:"",postcode:"",woonplaats:""});
  const [opgeslagen,setOpgeslagen]=useState(null);
  const [motorKeuze,setMotorKeuze]=useState(null); // null | "voorraad" | "nieuw"
  const [geselecteerdeVoorraad,setGeselecteerdeVoorraad]=useState(null);
  // eigen motor velden
  const [kenteken,setKenteken]=useState("");
  const [motorF,setMotorF]=useState({merk:"",model:"",bouwjaar:"",km:"",aankoopdatum:TODAY});
  const [rdwStatus,setRdwStatus]=useState(null);
  const setM=k=>e=>setMotorF(p=>({...p,[k]:e.target.value}));
  const normK=k=>k.replace(/-/g,"").toUpperCase();
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));

  if(opgeslagen) return <UitnodigingModal klant={opgeslagen} onClose={onClose}/>;

  const haalRDWOp = async () => {
    const ken = normK(kenteken);
    if(!ken) return;
    setRdwStatus("laden");
    try {
      const res = await fetch(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${ken}`);
      const data = await res.json();
      if(!data||data.length===0){ setRdwStatus("niet_gevonden"); return; }
      const v = data[0];
      setMotorF(p=>({
        ...p,
        merk: v.merk ? v.merk.charAt(0)+v.merk.slice(1).toLowerCase() : "",
        model: v.handelsbenaming || "",
        bouwjaar: v.datum_eerste_toelating ? v.datum_eerste_toelating.substring(0,4) : "",
      }));
      setRdwStatus("gevonden");
    } catch(e){ setRdwStatus("fout"); }
  };

  const sla_op = () => {
    if(!f.naam||!f.email) return;
    let motor = null;
    if(motorKeuze==="voorraad" && geselecteerdeVoorraad) {
      motor = {...geselecteerdeVoorraad, aankoopdatum: TODAY};
    } else if(motorKeuze==="nieuw" && normK(kenteken)) {
      motor = {...motorF, kenteken: normK(kenteken), bouwjaar:parseInt(motorF.bouwjaar)||0, km:parseInt(motorF.km)||0};
    }
    onSave({...f, motor, verwijderUitVoorraad: motorKeuze==="voorraad"&&geselecteerdeVoorraad?.id});
    setOpgeslagen({id:Date.now(), naam:f.naam, email:f.email});
  };

  return(
    <Modal title="KLANT TOEVOEGEN" onClose={onClose}>
      <div style={s.sectionLabel}>Klantgegevens</div>
      <Field label="Naam *"><input style={s.input} value={f.naam} onChange={set("naam")} placeholder="Voor- en achternaam"/></Field>
      <Grid2>
        <Field label="E-mail *"><input style={s.input} value={f.email} onChange={set("email")} placeholder="email@voorbeeld.nl"/></Field>
        <Field label="Telefoon"><input style={s.input} value={f.telefoon} onChange={set("telefoon")} placeholder="06-12345678"/></Field>
        <Field label="Adres"><input style={s.input} value={f.adres} onChange={set("adres")} placeholder="Straat + nr"/></Field>
        <Field label="Postcode"><input style={s.input} value={f.postcode} onChange={set("postcode")} placeholder="4691AA"/></Field>
      </Grid2>
      <Field label="Woonplaats"><input style={s.input} value={f.woonplaats} onChange={set("woonplaats")} placeholder="Stad/dorp"/></Field>

      <div style={{borderTop:`1px solid ${T.border}`,margin:"16px 0"}}/>
      <div style={s.sectionLabel}>Motor (optioneel)</div>

      {/* Keuze knoppen */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={()=>setMotorKeuze("voorraad")} style={{flex:1,padding:"10px",borderRadius:4,border:`1px solid ${motorKeuze==="voorraad"?T.accent:T.border}`,background:motorKeuze==="voorraad"?`${T.accent}20`:"transparent",color:motorKeuze==="voorraad"?T.accent:T.muted,cursor:"pointer",fontSize:13,fontFamily:"Barlow, sans-serif",fontWeight:motorKeuze==="voorraad"?600:400}}>
          📋 Uit voorraad
        </button>
        <button onClick={()=>setMotorKeuze("nieuw")} style={{flex:1,padding:"10px",borderRadius:4,border:`1px solid ${motorKeuze==="nieuw"?T.accent:T.border}`,background:motorKeuze==="nieuw"?`${T.accent}20`:"transparent",color:motorKeuze==="nieuw"?T.accent:T.muted,cursor:"pointer",fontSize:13,fontFamily:"Barlow, sans-serif",fontWeight:motorKeuze==="nieuw"?600:400}}>
          🔍 Eigen motor
        </button>
        {motorKeuze&&<button onClick={()=>{setMotorKeuze(null);setGeselecteerdeVoorraad(null);}} style={{padding:"10px 12px",borderRadius:4,border:`1px solid ${T.border}`,background:"transparent",color:T.muted,cursor:"pointer",fontSize:12,fontFamily:"Barlow, sans-serif"}}>✕</button>}
      </div>

      {/* Uit voorraad */}
      {motorKeuze==="voorraad"&&(
        <div>
          {voorraad.length===0?(
            <div style={{fontSize:13,color:T.muted,padding:"10px 0"}}>Geen motors in voorraad</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {voorraad.map(m=>(
                <div key={m.id} onClick={()=>setGeselecteerdeVoorraad(m)}
                  style={{padding:"10px 12px",borderRadius:4,border:`1px solid ${geselecteerdeVoorraad?.id===m.id?T.accent:T.border}`,background:geselecteerdeVoorraad?.id===m.id?`${T.accent}20`:"transparent",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500}}>{m.merk} {m.model}</div>
                    <div style={{fontSize:11,color:T.muted,marginTop:2}}>{m.kenteken} · {m.bouwjaar} · {m.km.toLocaleString()} km</div>
                  </div>
                  <div style={{fontSize:13,color:T.accent,fontWeight:600}}>€{m.prijs.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Eigen motor met RDW */}
      {motorKeuze==="nieuw"&&(
        <div>
          <div style={{display:"flex",gap:8,marginBottom:6}}>
            <input style={{...s.input,flex:1,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,textTransform:"uppercase"}}
              value={kenteken} onChange={e=>setKenteken(e.target.value)} placeholder="AB-123-C"
              onKeyDown={e=>e.key==="Enter"&&haalRDWOp()}/>
            <button style={{...s.btn,flexShrink:0}} onClick={haalRDWOp} disabled={rdwStatus==="laden"}>
              {rdwStatus==="laden"?"Laden...":"Ophalen →"}
            </button>
          </div>
          {rdwStatus==="gevonden"&&<div style={{fontSize:12,color:T.green,marginBottom:10}}>✓ Gegevens opgehaald — controleer hieronder.</div>}
          {rdwStatus==="niet_gevonden"&&<div style={{fontSize:12,color:T.red,marginBottom:10}}>⚠ Niet gevonden — vul handmatig in.</div>}
          {rdwStatus==="fout"&&<div style={{fontSize:12,color:T.red,marginBottom:10}}>⚠ Verbinding mislukt — vul handmatig in.</div>}
          <Grid2>
            <Field label="Merk"><input style={s.input} value={motorF.merk} onChange={setM("merk")} placeholder="Honda"/></Field>
            <Field label="Model"><input style={s.input} value={motorF.model} onChange={setM("model")} placeholder="CB500F"/></Field>
            <Field label="Bouwjaar"><input style={s.input} value={motorF.bouwjaar} onChange={setM("bouwjaar")} placeholder="2022"/></Field>
            <Field label="Kilometerstand"><input style={s.input} value={motorF.km} onChange={setM("km")} placeholder="15000"/></Field>
          </Grid2>
        </div>
      )}

      <ModalFooter onClose={onClose} label="Opslaan" onClick={sla_op}/>
    </Modal>
  );
}

function MotorModal({onSave,onClose}){
  const [f,setF]=useState({kenteken:"",merk:"",model:"",bouwjaar:"",km:"",aankoopdatum:TODAY});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  return(
    <Modal title="MOTOR TOEVOEGEN" onClose={onClose}>
      <Grid2>
        <Field label="Kenteken *"><input style={s.input} value={f.kenteken} onChange={set("kenteken")} placeholder="AB-123-C"/></Field>
        <Field label="Aankoopdatum"><input style={s.input} type="date" value={f.aankoopdatum} onChange={set("aankoopdatum")}/></Field>
        <Field label="Merk *"><input style={s.input} value={f.merk} onChange={set("merk")} placeholder="Honda"/></Field>
        <Field label="Model"><input style={s.input} value={f.model} onChange={set("model")} placeholder="CB500F"/></Field>
        <Field label="Bouwjaar"><input style={s.input} value={f.bouwjaar} onChange={set("bouwjaar")} placeholder="2022"/></Field>
        <Field label="Kilometerstand"><input style={s.input} value={f.km} onChange={set("km")} placeholder="15000"/></Field>
      </Grid2>
      <ModalFooter onClose={onClose} label="Motor Toevoegen" onClick={()=>{if(f.kenteken&&f.merk){onSave(f);onClose();}}}/>
    </Modal>
  );
}

function BandInput({value, onChange}) {
  const parts = (value||"").split("/");
  const [w, setW] = useState(parts[0]||"");
  const [y, setY] = useState(parts[1]||"");
  const handleW = (v) => { setW(v); onChange(v && y ? `${v}/${y}` : ""); };
  const handleY = (v) => { setY(v); onChange(w && v ? `${w}/${v}` : ""); };
  return (
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <input style={{...s.input,width:62,padding:"8px 6px",textAlign:"center"}} type="number"
        min="1" max="53" value={w} onChange={e=>handleW(e.target.value)} placeholder="24"/>
      <span style={{color:T.muted,fontSize:13,flexShrink:0}}>/ week</span>
      <input style={{...s.input,width:72,padding:"8px 6px",textAlign:"center"}} type="number"
        min="1990" max="2100" value={y} onChange={e=>handleY(e.target.value)} placeholder="2026"/>
    </div>
  );
}

function BandTag({datum}) {
  if(!datum) return null;
  const jaren = bandLeeftijd(datum);
  const bs = bandStatus(jaren);
  if(!bs) return <span style={{fontSize:11,color:T.muted}}>{datum}</span>;
  return <span style={{fontSize:11,color:bs.kleur,fontWeight:600}}>{bs.icon} {datum} ({bs.label})</span>;
}

function ServiceModal({onSave,onClose,initial}){
  const [f,setF]=useState({
    datum: initial?.datum||TODAY,
    omschrijving: initial?.omschrijving||"",
    km: initial?.km||"",
    voorband_datum: initial?.voorband_datum||"",
    achterband_datum: initial?.achterband_datum||"",
  });
  return(
    <Modal title={initial?"SERVICE BEWERKEN":"SERVICE TOEVOEGEN"} onClose={onClose}>
      <Grid2>
        <Field label="Datum"><input style={s.input} type="date" value={f.datum} onChange={e=>setF(p=>({...p,datum:e.target.value}))}/></Field>
        <Field label="Kilometerstand"><input style={s.input} type="number" value={f.km} onChange={e=>setF(p=>({...p,km:e.target.value}))} placeholder="bijv. 35000"/></Field>
      </Grid2>
      <Field label="Omschrijving">
        <textarea style={{...s.input,height:90,resize:"vertical"}} value={f.omschrijving} onChange={e=>setF(p=>({...p,omschrijving:e.target.value}))} placeholder="Wat is er gedaan?"/>
      </Field>
      <div style={{borderTop:`1px solid ${T.border}`,margin:"14px 0 12px"}}/>
      <div style={s.sectionLabel}>Bandendatums (optioneel)</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:10,marginTop:-8}}>Weeknummer / jaar van productie (staat op de zijkant van de band)</div>
      <Grid2>
        <Field label="Voorband"><BandInput value={f.voorband_datum} onChange={v=>setF(p=>({...p,voorband_datum:v}))}/></Field>
        <Field label="Achterband"><BandInput value={f.achterband_datum} onChange={v=>setF(p=>({...p,achterband_datum:v}))}/></Field>
      </Grid2>
      <ModalFooter onClose={onClose} onClick={()=>{if(f.omschrijving){onSave(f);onClose();}}}/>
    </Modal>
  );
}

function VoorraadModal({onSave,onClose}){
  const [kenteken,setKenteken]=useState("");
  const [f,setF]=useState({merk:"",model:"",bouwjaar:"",km:"",prijs:"",datum_in:TODAY,chassis_nummer:"",voorband_datum:"",achterband_datum:""});
  const [rdwStatus,setRdwStatus]=useState(null);
  const [fotoFiles,setFotoFiles]=useState([]);
  const [fotoPreviews,setFotoPreviews]=useState([]);
  const [uploadStatus,setUploadStatus]=useState(null);
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));

  const normKenteken = k => k.replace(/-/g,"").toUpperCase();

  const haalRDWOp = async () => {
    const ken = normKenteken(kenteken);
    if(!ken) return;
    setRdwStatus("laden");
    try {
      const res = await fetch(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${ken}`);
      const data = await res.json();
      if(!data||data.length===0){ setRdwStatus("niet_gevonden"); return; }
      const v = data[0];
      setF(p=>({...p,
        merk: v.merk ? v.merk.charAt(0)+v.merk.slice(1).toLowerCase() : "",
        model: v.handelsbenaming || "",
        bouwjaar: v.datum_eerste_toelating ? v.datum_eerste_toelating.substring(0,4) : "",
      }));
      setRdwStatus("gevonden");
    } catch{ setRdwStatus("fout"); }
  };

  const voegFotosToe = (e) => {
    const files = Array.from(e.target.files||[]);
    if(!files.length) return;
    setFotoFiles(p=>[...p,...files]);
    setFotoPreviews(p=>[...p,...files.map(f=>URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const verwijderFoto = (i) => {
    URL.revokeObjectURL(fotoPreviews[i]);
    setFotoFiles(p=>p.filter((_,j)=>j!==i));
    setFotoPreviews(p=>p.filter((_,j)=>j!==i));
  };

  const opslaan = async () => {
    const ken = normKenteken(kenteken);
    if(!ken||!f.merk) return;
    setUploadStatus("laden");
    try {
      const urls = fotoFiles.length > 0
        ? await Promise.all(fotoFiles.map(file=>uploadFoto(file)))
        : [];
      onSave({...f, kenteken:ken, fotos:urls});
      onClose();
    } catch(e){
      setUploadStatus("fout: "+e.message);
    }
  };

  const kentekenGeformateerd = normKenteken(kenteken);

  return(
    <Modal title="MOTOR TOEVOEGEN — VOORRAAD" onClose={onClose}>
      {/* Stap 1 */}
      <div style={s.sectionLabel}>Stap 1 — Kenteken opzoeken via RDW</div>
      <div style={{display:"flex",gap:8,marginBottom:6}}>
        <input style={{...s.input,flex:1,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,letterSpacing:2,textTransform:"uppercase"}}
          value={kenteken} onChange={e=>setKenteken(e.target.value)}
          placeholder="AB-123-C" onKeyDown={e=>e.key==="Enter"&&haalRDWOp()}/>
        <button style={{...s.btn,flexShrink:0}} onClick={haalRDWOp} disabled={rdwStatus==="laden"}>
          {rdwStatus==="laden"?"Laden...":"Ophalen →"}
        </button>
      </div>
      {rdwStatus==="niet_gevonden"&&<div style={{fontSize:12,color:T.red,marginBottom:10}}>⚠ Kenteken niet gevonden — vul handmatig in.</div>}
      {rdwStatus==="fout"&&<div style={{fontSize:12,color:T.red,marginBottom:10}}>⚠ Verbinding mislukt — vul handmatig in.</div>}
      {rdwStatus==="gevonden"&&<div style={{fontSize:12,color:T.green,marginBottom:10}}>✓ Gegevens opgehaald uit RDW.</div>}

      {/* Stap 2 */}
      <div style={{borderTop:`1px solid ${T.border}`,margin:"14px 0"}}/>
      <div style={s.sectionLabel}>Stap 2 — Gegevens controleren / aanvullen</div>
      <Grid2>
        <Field label="Merk"><input style={s.input} value={f.merk} onChange={set("merk")} placeholder="Honda"/></Field>
        <Field label="Model"><input style={s.input} value={f.model} onChange={set("model")} placeholder="CB500F"/></Field>
        <Field label="Bouwjaar"><input style={s.input} value={f.bouwjaar} onChange={set("bouwjaar")} placeholder="2022"/></Field>
        <Field label="Kilometerstand"><input style={s.input} value={f.km} onChange={set("km")} placeholder="15000"/></Field>
        <Field label="Vraagprijs (€)"><input style={s.input} value={f.prijs} onChange={set("prijs")} placeholder="8500"/></Field>
        <Field label="Datum binnenkomst"><input style={s.input} type="date" value={f.datum_in} onChange={set("datum_in")}/></Field>
      </Grid2>
      <Field label="Chassisnummer (optioneel)"><input style={{...s.input,fontFamily:"Barlow Condensed, sans-serif",letterSpacing:1}} value={f.chassis_nummer} onChange={set("chassis_nummer")} placeholder="WB10309C4ZP123456"/></Field>

      {/* Stap 3: bandendatums */}
      <div style={{borderTop:`1px solid ${T.border}`,margin:"14px 0"}}/>
      <div style={s.sectionLabel}>Stap 3 — Bandendatums (optioneel)</div>
      <div style={{fontSize:11,color:T.muted,marginBottom:12,marginTop:-8}}>Productieweek / jaar (staat op de zijkant van de band)</div>
      <Grid2>
        <Field label="Voorband"><BandInput value={f.voorband_datum} onChange={v=>setF(p=>({...p,voorband_datum:v}))}/></Field>
        <Field label="Achterband"><BandInput value={f.achterband_datum} onChange={v=>setF(p=>({...p,achterband_datum:v}))}/></Field>
      </Grid2>

      {/* Stap 4: foto's */}
      <div style={{borderTop:`1px solid ${T.border}`,margin:"14px 0"}}/>
      <div style={s.sectionLabel}>Stap 4 — Foto's (optioneel)</div>
      <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",border:`1px dashed ${T.border}`,borderRadius:4,cursor:"pointer",marginBottom:12}}>
        <span style={{fontSize:22}}>📷</span>
        <div>
          <div style={{fontSize:13,color:T.text,fontWeight:500}}>Foto's toevoegen</div>
          <div style={{fontSize:11,color:T.muted}}>Meerdere tegelijk mogelijk · worden automatisch verkleind</div>
        </div>
        <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={voegFotosToe}/>
      </label>
      {fotoPreviews.length>0&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {fotoPreviews.map((url,i)=>(
            <div key={i} style={{position:"relative",flexShrink:0}}>
              <img src={url} alt="" style={{width:80,height:80,objectFit:"cover",borderRadius:4,border:`1px solid ${T.border}`}}/>
              <button onClick={()=>verwijderFoto(i)} style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:T.red,color:"#fff",border:"none",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
      {uploadStatus==="laden"&&<div style={{fontSize:12,color:T.accent,marginBottom:10}}>⬆ Foto's uploaden…</div>}
      {uploadStatus&&uploadStatus.startsWith("fout")&&<div style={{fontSize:12,color:T.red,marginBottom:10}}>⚠ {uploadStatus}</div>}

      <ModalFooter onClose={onClose} label={uploadStatus==="laden"?"Bezig…":"Toevoegen aan voorraad"}
        onClick={opslaan}/>
    </Modal>
  );
}

function VoorraadEditModal({motor, onSave, onClose}){
  const [f,setF]=useState({
    merk:motor.merk||"", model:motor.model||"", bouwjaar:motor.bouwjaar||"",
    km:motor.km||"", prijs:motor.prijs||"", datum_in:motor.datum_in||TODAY,
    chassis_nummer:motor.chassis_nummer||"",
    voorband_datum:motor.voorband_datum||"", achterband_datum:motor.achterband_datum||"",
  });
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const [behoudeFotos,setBehoudeFotos]=useState(Array.isArray(motor.fotos)?motor.fotos:[]);
  const [nieuweFotoFiles,setNieuweFotoFiles]=useState([]);
  const [nieuweFotoPreviews,setNieuweFotoPreviews]=useState([]);
  const [uploadStatus,setUploadStatus]=useState(null);

  const voegFotosToe=(e)=>{
    const files=Array.from(e.target.files||[]);
    if(!files.length) return;
    setNieuweFotoFiles(p=>[...p,...files]);
    setNieuweFotoPreviews(p=>[...p,...files.map(fi=>URL.createObjectURL(fi))]);
    e.target.value="";
  };
  const verwijderNieuw=(i)=>{
    URL.revokeObjectURL(nieuweFotoPreviews[i]);
    setNieuweFotoFiles(p=>p.filter((_,j)=>j!==i));
    setNieuweFotoPreviews(p=>p.filter((_,j)=>j!==i));
  };
  const opslaan=async()=>{
    if(!f.merk) return;
    setUploadStatus("laden");
    try{
      const nieuweUrls=nieuweFotoFiles.length>0
        ? await Promise.all(nieuweFotoFiles.map(fi=>uploadFoto(fi)))
        : [];
      const verwijderdeUrls=(motor.fotos||[]).filter(u=>!behoudeFotos.includes(u));
      onSave(motor.id, f, behoudeFotos, nieuweUrls, verwijderdeUrls);
      onClose();
    }catch(e){ setUploadStatus("fout: "+e.message); }
  };

  return(
    <Modal title="MOTOR WIJZIGEN" onClose={onClose}>
      <Grid2>
        <Field label="Merk *"><input style={s.input} value={f.merk} onChange={set("merk")} placeholder="Honda"/></Field>
        <Field label="Model"><input style={s.input} value={f.model} onChange={set("model")} placeholder="CB500F"/></Field>
        <Field label="Bouwjaar"><input style={s.input} value={f.bouwjaar} onChange={set("bouwjaar")} placeholder="2022"/></Field>
        <Field label="Kilometerstand"><input style={s.input} value={f.km} onChange={set("km")} placeholder="15000"/></Field>
        <Field label="Vraagprijs (€)"><input style={s.input} value={f.prijs} onChange={set("prijs")} placeholder="8500"/></Field>
        <Field label="Datum binnenkomst"><input style={s.input} type="date" value={f.datum_in} onChange={set("datum_in")}/></Field>
      </Grid2>
      <Field label="Chassisnummer">
        <input style={{...s.input,fontFamily:"Barlow Condensed, sans-serif",letterSpacing:1}} value={f.chassis_nummer} onChange={set("chassis_nummer")} placeholder="WB10309C4ZP123456"/>
      </Field>
      <div style={{borderTop:`1px solid ${T.border}`,margin:"14px 0 12px"}}/>
      <div style={s.sectionLabel}>Bandendatums</div>
      <Grid2>
        <Field label="Voorband"><BandInput value={f.voorband_datum} onChange={v=>setF(p=>({...p,voorband_datum:v}))}/></Field>
        <Field label="Achterband"><BandInput value={f.achterband_datum} onChange={v=>setF(p=>({...p,achterband_datum:v}))}/></Field>
      </Grid2>
      <div style={{borderTop:`1px solid ${T.border}`,margin:"14px 0 12px"}}/>
      <div style={s.sectionLabel}>Foto's</div>
      {behoudeFotos.length>0&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {behoudeFotos.map((url,i)=>(
            <div key={i} style={{position:"relative",flexShrink:0}}>
              <img src={clImg(url,200)} alt="" style={{width:80,height:80,objectFit:"cover",borderRadius:4,border:`1px solid ${T.border}`}}/>
              <button onClick={()=>setBehoudeFotos(p=>p.filter((_,j)=>j!==i))}
                style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:T.red,color:"#fff",border:"none",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
      {nieuweFotoPreviews.length>0&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {nieuweFotoPreviews.map((url,i)=>(
            <div key={i} style={{position:"relative",flexShrink:0}}>
              <img src={url} alt="" style={{width:80,height:80,objectFit:"cover",borderRadius:4,border:`1px dashed ${T.accent}`}}/>
              <button onClick={()=>verwijderNieuw(i)}
                style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:T.red,color:"#fff",border:"none",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>✕</button>
            </div>
          ))}
        </div>
      )}
      <label style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",border:`1px dashed ${T.border}`,borderRadius:4,cursor:"pointer",marginBottom:12}}>
        <span style={{fontSize:20}}>📷</span>
        <div style={{fontSize:13,color:T.muted}}>Foto's toevoegen</div>
        <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={voegFotosToe}/>
      </label>
      {uploadStatus==="laden"&&<div style={{fontSize:12,color:T.accent,marginBottom:10}}>⬆ Uploaden…</div>}
      {uploadStatus&&uploadStatus.startsWith("fout")&&<div style={{fontSize:12,color:T.red,marginBottom:10}}>⚠ {uploadStatus}</div>}
      <ModalFooter onClose={onClose} label={uploadStatus==="laden"?"Bezig…":"Opslaan"} onClick={opslaan}/>
    </Modal>
  );
}

function AfspraakModal({afspraken,klanten,onSave,onClose}){
  const [f,setF]=useState({klant:"",motor:"",datum:TODAY,duur:"1",omschrijving:"",tijd:""});
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value,...(k==="datum"?{tijd:""}:{})}));
  const selectedKlant=klanten.find(k=>k.naam===f.klant);
  const serviceSlots=f.datum&&f.duur?getSlots(afspraken.filter(a=>a.type!=="proefrit"),f.datum,parseInt(f.duur)):[];
  const kanOpslaan=f.klant&&f.tijd;

  return(
    <Modal title="AFSPRAAK INPLANNEN" onClose={onClose}>
      <Field label="Klant">
        <select style={s.input} value={f.klant} onChange={e=>setF(p=>({...p,klant:e.target.value,motor:"",tijd:""}))}>
          <option value="">— Selecteer klant —</option>
          {klanten.map(k=><option key={k.id}>{k.naam}</option>)}
          <option value="Walk-in">Walk-in / Onbekend</option>
        </select>
      </Field>
      {selectedKlant&&(
        <Field label="Motor">
          <select style={s.input} value={f.motor} onChange={set("motor")}>
            <option value="">— Selecteer motor —</option>
            {selectedKlant.motoren.map(m=><option key={m.id}>{m.kenteken} — {m.merk} {m.model}</option>)}
          </select>
        </Field>
      )}
      <Grid2>
        <Field label="Datum"><input style={s.input} type="date" value={f.datum} onChange={set("datum")}/></Field>
        <Field label="Duur (uur)">
          <select style={s.input} value={f.duur} onChange={e=>setF(p=>({...p,duur:e.target.value,tijd:""}))}>
            {[1,2,3,4,5,6,7,8].map(h=><option key={h}>{h}</option>)}
          </select>
        </Field>
      </Grid2>
      {f.datum&&(
        <Field label={`Beschikbare tijden — ${fmtDate(f.datum)} — ${f.duur}u blok`}>
          {serviceSlots.length===0?(
            <div style={{padding:"10px 12px",background:T.surf2,borderRadius:4,color:T.red,fontSize:13}}>
              ⚠ Geen vrij blok beschikbaar op deze dag
            </div>
          ):(
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {serviceSlots.map(t=>(
                <button key={t} onClick={()=>setF(p=>({...p,tijd:t}))}
                  style={{padding:"7px 13px",borderRadius:4,border:`1px solid ${f.tijd===t?T.accent:T.border}`,background:f.tijd===t?`${T.accent}25`:"transparent",color:f.tijd===t?T.accent:T.muted,cursor:"pointer",fontSize:13,fontFamily:"Barlow, sans-serif"}}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </Field>
      )}
      <Field label="Opmerkingen">
        <textarea style={{...s.input,height:70,resize:"vertical"}} value={f.omschrijving} onChange={e=>setF(p=>({...p,omschrijving:e.target.value}))} placeholder="Wat moet er gedaan worden?"/>
      </Field>
      <ModalFooter onClose={onClose} label="Inplannen" onClick={()=>{if(kanOpslaan){onSave({...f,type:"service",duur:parseInt(f.duur)});onClose();}}}/>
    </Modal>
  );
}

function ProefritModal({motor, afspraken, onSave, onClose}){
  const [f,setF]=useState({naam:"",datum:TODAY,tijd:"",omschrijving:""});
  const slots=f.datum?getProefritSlots(afspraken,f.datum):[];
  return(
    <Modal title="PROEFRIT INBOEKEN" onClose={onClose}>
      <div style={{background:`${T.green}15`,border:`1px solid ${T.green}40`,borderRadius:5,padding:"8px 12px",marginBottom:14,fontSize:13,color:T.green}}>
        🏍 {motor.merk} {motor.model} — {motor.kenteken}
      </div>
      <Field label="Naam proefrijder *">
        <input style={s.input} value={f.naam} onChange={e=>setF(p=>({...p,naam:e.target.value}))} placeholder="Voornaam Achternaam"/>
      </Field>
      <Field label="Datum">
        <input style={s.input} type="date" value={f.datum} onChange={e=>setF(p=>({...p,datum:e.target.value,tijd:""}))}/>
      </Field>
      {f.datum&&(
        <Field label={`Beschikbare tijden — ${fmtDate(f.datum)}`}>
          {slots.length===0?(
            <div style={{padding:"10px 12px",background:T.surf2,borderRadius:4,color:T.red,fontSize:13}}>⚠ Beide dagdelen zijn al volgeboekt op deze dag</div>
          ):(
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {slots.map(t=>(
                <button key={t} onClick={()=>setF(p=>({...p,tijd:t}))}
                  style={{padding:"7px 13px",borderRadius:4,border:`1px solid ${f.tijd===t?T.green:T.border}`,background:f.tijd===t?`${T.green}25`:"transparent",color:f.tijd===t?T.green:T.muted,cursor:"pointer",fontSize:13,fontFamily:"Barlow, sans-serif"}}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </Field>
      )}
      <Field label="Opmerkingen">
        <textarea style={{...s.input,height:70,resize:"vertical"}} value={f.omschrijving} onChange={e=>setF(p=>({...p,omschrijving:e.target.value}))} placeholder="Eventuele opmerkingen"/>
      </Field>
      <ModalFooter onClose={onClose} label="Inplannen"
        onClick={()=>{if(f.naam&&f.tijd){onSave({type:"proefrit",naam:f.naam,datum:f.datum,tijd:f.tijd,omschrijving:f.omschrijving,duur:1,voorraad_motor_id:motor.id});onClose();}}}/>
    </Modal>
  );
}

// ── Pages ────────────────────────────────────────────────────────────────────
function Dashboard({klanten,showroom,afspraken,onNav}){
  const isMobile=useIsMobile();
  const totalMotoren=klanten.reduce((a,k)=>a+(k.motoren||[]).length,0);
  const aanvragen=afspraken.filter(a=>a.status==="aangevraagd");
  const gepland=afspraken.filter(a=>a.status!=="aangevraagd");
  const vandaag=gepland.filter(a=>a.datum===TODAY);
  const komend=gepland.filter(a=>a.datum>=TODAY).sort((a,b)=>a.datum.localeCompare(b.datum)||(a.tijd||"").localeCompare(b.tijd||"")).slice(0,6);

  const getMotorInfo = (motorId) => {
    const motor = klanten.flatMap(k=>k.motoren||[]).find(m=>m.id===motorId);
    if(!motor) return {label:null,km:null};
    const lastKm = (motor.kmHistory||[]).slice().sort((x,y)=>x.datum.localeCompare(y.datum)).pop()?.km||null;
    return {label:[motor.merk,motor.model].filter(Boolean).join(" ")||null, km:lastKm};
  };

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:14,marginBottom:22}}>
        {[{num:klanten.length,lbl:"Klanten"},{num:totalMotoren,lbl:"Motoren"},{num:showroom.length,lbl:"Voorraad"},{num:vandaag.length,lbl:"Afspraken vandaag",sub:aanvragen.length>0?`+ ${aanvragen.length} aanvraag`:null}].map((x,i)=>(
          <div key={i} style={s.statCard}>
            <div style={s.statNum}>{x.num}</div>
            <div style={s.statLabel}>{x.lbl}</div>
            {x.sub&&<div style={{fontSize:11,color:T.yellow,marginTop:4,fontWeight:600}}>{x.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14}}>
        <div style={s.card}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:1,marginBottom:14,textTransform:"uppercase",color:T.text}}>
            Vandaag · {fmtDate(TODAY)}
          </div>
          {vandaag.length===0?<div style={{color:T.muted,fontSize:13}}>Geen afspraken vandaag</div>:vandaag.map(a=>{
            const {label,km}=getMotorInfo(a.motor_id);
            return(
              <div key={a.id} style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`,display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{background:T.accent,color:"#fff",padding:"3px 8px",borderRadius:3,fontSize:12,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{a.tijd}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:500}}>{a.klant}</div>
                  {label&&<div style={{fontSize:12,color:T.accent,marginTop:1}}>{label}{km?` · ${km.toLocaleString()} km`:""}</div>}
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>{a.omschrijving} · {a.duur}u</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={s.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:1,textTransform:"uppercase"}}>Komende Afspraken</div>
            <button style={s.btn} onClick={()=>onNav("agenda")}>+ Nieuw</button>
          </div>
          {komend.map(a=>{
            const {label,km}=getMotorInfo(a.motor_id);
            return(
              <div key={a.id} style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500}}>{a.klant}</div>
                    {label&&<div style={{fontSize:12,color:T.accent,marginTop:1}}>{label}{km?` · ${km.toLocaleString()} km`:""}</div>}
                    <div style={{fontSize:12,color:T.muted,marginTop:2}}>{a.omschrijving}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                    <div style={{fontSize:12,color:T.accent}}>{fmtDate(a.datum)}</div>
                    <div style={{fontSize:12,color:T.muted}}>{a.tijd} · {a.duur}u</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KlantDetail({klant,onUpdateKlant,onAddMotor,onAddService,onUpdateService,onDeleteService,onDeleteKlant,onUpdateMotorInterval,onUitnodig,onBack,isMobile}){
  const [modal,setModal]=useState(null);
  const [selMotorId,setSelMotorId]=useState(null);
  const [editIntervalId,setEditIntervalId]=useState(null);
  const [intervalVal,setIntervalVal]=useState("");
  const [editSvc,setEditSvc]=useState(null);
  const [delSvcId,setDelSvcId]=useState(null);
  const [delKlant,setDelKlant]=useState(false);
  const [toonMenu,setToonMenu]=useState(false);
  const klantMotoren=klant?.motoren||[];
  const addMotor=f=>onAddMotor(klant.id,f);
  const addService=f=>{ if(selMotorId) onAddService(klant.id,selMotorId,f); };
  const slaIntervalOp=async(motorId)=>{
    const km=parseInt(intervalVal);
    if(!km||km<100) return;
    await onUpdateMotorInterval(motorId,km);
    setEditIntervalId(null);
  };
  return(
    <div>
      {isMobile&&(
        <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",padding:"0 0 12px",display:"flex",alignItems:"center",gap:4}}>
          ← Alle klanten
        </button>
      )}
      <div style={{...s.card,marginBottom:14}}>
        {/* Naam + knoppen op eigen rij zodat adres volle breedte krijgt */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:8}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:22,flex:1,minWidth:0,wordBreak:"break-word"}}>{klant.naam}</div>
          <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
            {klant.status!=="goedgekeurd"&&(
              <button style={{...s.btn,background:T.green,padding:"7px 10px",fontSize:12,whiteSpace:"nowrap"}} onClick={()=>onUpdateKlant({...klant,status:"goedgekeurd"})}>✓ Goedkeuren</button>
            )}
            <button style={s.btn} onClick={()=>setModal("addMotor")}>+ Motor</button>
            <div style={{position:"relative"}}>
              <button style={{...s.btnGhost,width:34,height:34,padding:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,letterSpacing:0,flexShrink:0}} onClick={()=>setToonMenu(v=>!v)}>⋮</button>
              {toonMenu&&<div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setToonMenu(false)}/>}
              {toonMenu&&(
                <div style={{position:"absolute",right:0,top:38,background:T.surf2,border:`1px solid ${T.border}`,borderRadius:6,minWidth:170,zIndex:100,boxShadow:"0 4px 20px #0009",overflow:"hidden"}}>
                  <button onClick={()=>{onUitnodig(klant);setToonMenu(false);}} style={{display:"block",width:"100%",padding:"11px 14px",background:"none",border:"none",color:T.text,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",textAlign:"left"}}>Uitnodigen</button>
                  {klant.status!=="afgewezen"&&(
                    <button onClick={()=>{onUpdateKlant({...klant,status:"afgewezen"});setToonMenu(false);}} style={{display:"block",width:"100%",padding:"11px 14px",background:"none",border:"none",color:T.red,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",textAlign:"left"}}>✕ Afwijzen</button>
                  )}
                  {klant.status==="afgewezen"&&(
                    <button onClick={()=>{onUpdateKlant({...klant,status:"goedgekeurd"});setToonMenu(false);}} style={{display:"block",width:"100%",padding:"11px 14px",background:"none",border:"none",color:T.green,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",textAlign:"left"}}>✓ Goedkeuren</button>
                  )}
                  <div style={{height:1,background:T.border}}/>
                  <button onClick={()=>{setDelKlant(true);setToonMenu(false);}} style={{display:"block",width:"100%",padding:"11px 14px",background:"none",border:"none",color:T.red,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",textAlign:"left"}}>Verwijder klant</button>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Status badge + adres + contact — volle breedte */}
        <div style={{marginTop:2}}>
          <div style={{marginBottom:6}}>
            {klant.status==="in_afwachting"&&<span style={{fontSize:11,background:`${T.yellow}20`,color:T.yellow,padding:"2px 8px",borderRadius:3,fontWeight:600}}>⏳ Wacht op goedkeuring</span>}
            {klant.status==="goedgekeurd"&&<span style={{fontSize:11,background:`${T.green}20`,color:T.green,padding:"2px 8px",borderRadius:3,fontWeight:600}}>✓ Goedgekeurd</span>}
            {klant.status==="afgewezen"&&<span style={{fontSize:11,background:`${T.red}20`,color:T.red,padding:"2px 8px",borderRadius:3,fontWeight:600}}>✕ Afgewezen</span>}
          </div>
          <div style={{fontSize:13,color:T.muted,lineHeight:1.8}}>
            {(klant.adres||klant.postcode||klant.woonplaats)&&(
              <div>{klant.adres}{klant.postcode||klant.woonplaats ? `, ${[klant.postcode,klant.woonplaats].filter(Boolean).join(" ")}` : ""}</div>
            )}
            <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:2,alignItems:"center"}}>
              {klant.email&&<span>{klant.email}</span>}
              {klant.telefoon&&<a href={`tel:${klant.telefoon}`} style={{color:T.accent,textDecoration:"none",fontWeight:500,whiteSpace:"nowrap"}}>{klant.telefoon}</a>}
            </div>
          </div>
        </div>
        {delKlant&&(
          <div style={{marginTop:14,padding:"12px 14px",background:`${T.red}15`,border:`1px solid ${T.red}40`,borderRadius:6}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:8}}>
              Klant <span style={{color:T.red}}>{klant.naam}</span> en alle bijbehorende motoren, servicehistorie en afspraken permanent verwijderen?
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...s.btn,background:T.red,flex:"none",padding:"8px 16px",fontSize:13}} onClick={()=>{onDeleteKlant(klant);onBack();}}>Ja, verwijder alles</button>
              <button style={{...s.btnGhost,flex:"none",padding:"8px 16px",fontSize:13}} onClick={()=>setDelKlant(false)}>Annuleer</button>
            </div>
          </div>
        )}
      </div>
      {klantMotoren.map(motor=>(
        <div key={motor.id} style={{...s.card,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:17}}>
                {motor.merk} {motor.model}
                <span style={{...s.badge(T.accent),marginLeft:10,fontSize:10}}>{motor.kenteken}</span>
              </div>
              <div style={{fontSize:12,color:T.muted,marginTop:4}}>
                {motor.bouwjaar} · {motor.kmHistory?.length ? motor.kmHistory[motor.kmHistory.length-1].km.toLocaleString() : "—"} km · {motor.aankoopdatum ? `Gekocht ${motor.aankoopdatum}` : "Eigen motor"}
              </div>
            </div>
            <button style={{...s.btn,flexShrink:0}} onClick={()=>{setSelMotorId(motor.id);setModal("addService");}}>+ Service</button>
          </div>
          {/* Onderhoudsinterval */}
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:T.surf2,borderRadius:4,marginBottom:10,flexWrap:"wrap"}}>
            <span style={{fontSize:11,color:T.muted}}>Onderhoudsinterval:</span>
            {editIntervalId===motor.id?(
              <>
                <input style={{...s.input,width:90,padding:"4px 8px",fontSize:12}} type="number"
                  value={intervalVal} onChange={e=>setIntervalVal(e.target.value)} placeholder="5000"
                  onKeyDown={e=>e.key==="Enter"&&slaIntervalOp(motor.id)}/>
                <span style={{fontSize:11,color:T.muted}}>km</span>
                <button onClick={()=>slaIntervalOp(motor.id)} style={{...s.btn,padding:"4px 12px",fontSize:11}}>Opslaan</button>
                <button onClick={()=>setEditIntervalId(null)} style={{...s.btnGhost,padding:"4px 10px",fontSize:11}}>Annuleer</button>
              </>
            ):(
              <>
                <span style={{fontSize:12,fontWeight:600}}>{(motor.interval_km||5000).toLocaleString()} km</span>
                <button onClick={()=>{setEditIntervalId(motor.id);setIntervalVal(String(motor.interval_km||5000));}}
                  style={{background:"none",border:"none",color:T.accent,fontSize:12,cursor:"pointer",fontFamily:"Barlow, sans-serif",padding:0}}>
                  ✏ Bewerken
                </button>
              </>
            )}
          </div>
          {(motor.service||[]).length===0?(
            <div style={{fontSize:12,color:T.muted,padding:"6px 0"}}>Nog geen servicemeldingen</div>
          ):(
            (motor.service||[]).slice().reverse().map(sv=>(
              <div key={sv.id} style={{padding:"8px 0",borderTop:`1px solid ${T.border}`}}>
                {delSvcId===sv.id?(
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:`${T.red}18`,borderRadius:4}}>
                    <span style={{fontSize:12,flex:1,color:T.text}}>Servicebeurt verwijderen?</span>
                    <button onClick={()=>{onDeleteService(klant.id,motor.id,sv.id);setDelSvcId(null);}} style={{background:T.red,color:"#fff",border:"none",borderRadius:3,padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"Barlow, sans-serif"}}>Ja, verwijder</button>
                    <button onClick={()=>setDelSvcId(null)} style={{background:"none",border:`1px solid ${T.border}`,color:T.muted,borderRadius:3,padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"Barlow, sans-serif"}}>Annuleer</button>
                  </div>
                ):(
                  <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                    <div style={{fontSize:12,color:T.accent,whiteSpace:"nowrap",paddingTop:1,minWidth:80}}>{sv.datum}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13}}>{sv.omschrijving}</div>
                      {sv.km&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>bij {sv.km.toLocaleString()} km</div>}
                      {(sv.voorband_datum||sv.achterband_datum)&&<div style={{display:"flex",gap:10,marginTop:3}}>
                        {sv.voorband_datum&&<span style={{fontSize:10,color:T.muted}}>V: <BandTag datum={sv.voorband_datum}/></span>}
                        {sv.achterband_datum&&<span style={{fontSize:10,color:T.muted}}>A: <BandTag datum={sv.achterband_datum}/></span>}
                      </div>}
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <button onClick={()=>setEditSvc({...sv,motorId:motor.id})} style={{background:"none",border:"none",color:T.accent,fontSize:13,cursor:"pointer",padding:"2px 4px",fontFamily:"Barlow, sans-serif"}}>✏</button>
                      <button onClick={()=>setDelSvcId(sv.id)} style={{background:"none",border:"none",color:T.red,fontSize:13,cursor:"pointer",padding:"2px 4px",fontFamily:"Barlow, sans-serif"}}>🗑</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ))}
      {modal==="addMotor"&&<MotorModal onSave={addMotor} onClose={()=>setModal(null)}/>}
      {modal==="addService"&&<ServiceModal onSave={addService} onClose={()=>setModal(null)}/>}
      {editSvc&&<ServiceModal initial={editSvc} onSave={f=>{ onUpdateService(klant.id,editSvc.motorId,editSvc.id,f); setEditSvc(null); }} onClose={()=>setEditSvc(null)}/>}
    </div>
  );
}

function KlantenPage({klanten,onAddKlant,onUpdateKlant,onAddMotor,onAddService,onUpdateService,onDeleteService,onDeleteKlant,onUpdateMotorInterval,voorraad=[]}){
  const isMobile=useIsMobile();
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("alle");
  const [sel,setSel]=useState(null);
  const [modal,setModal]=useState(null);
  const [uitnodigKlant,setUitnodigKlant]=useState(null);

  const geenAccount=klanten.filter(k=>!k.user_id);
  const inAfwachting=klanten.filter(k=>k.status==="in_afwachting");

  const filtered=klanten.filter(k=>{
    const matchSearch=k.naam.toLowerCase().includes(search.toLowerCase())||
      (k.motoren||[]).some(m=>(m.kenteken||"").toLowerCase().includes(search.toLowerCase()));
    const matchFilter=filter==="alle"||(filter==="geen_account"&&!k.user_id)||(filter==="in_afwachting"&&k.status==="in_afwachting");
    return matchSearch&&matchFilter;
  });
  const klant=sel?klanten.find(k=>k.id===sel):null;

  const listPanel=(
    <div style={{display:"flex",flexDirection:"column",gap:8,height:"100%"}}>
      <div style={{display:"flex",gap:8}}>
        <input style={{...s.input,flex:1}} placeholder="Zoek naam of kenteken..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <button style={s.btn} onClick={()=>setModal("addKlant")}>+</button>
      </div>
      <div style={{display:"flex",gap:6}}>
        {[
          ["alle","Alle"],
          ["in_afwachting",`Wacht${inAfwachting.length>0?` (${inAfwachting.length})`:""}`],
          ["geen_account",`Geen account${geenAccount.length>0?` (${geenAccount.length})`:""}`]
        ].map(([id,lbl])=>(
          <button key={id} onClick={()=>setFilter(id)}
            style={{flex:1,padding:"7px 6px",borderRadius:4,border:`1px solid ${filter===id?(id==="in_afwachting"?T.yellow:T.accent):T.border}`,background:filter===id?`${id==="in_afwachting"?T.yellow:T.accent}20`:"transparent",color:filter===id?(id==="in_afwachting"?T.yellow:T.accent):T.muted,cursor:"pointer",fontSize:11,fontFamily:"Barlow, sans-serif"}}>
            {lbl}
          </button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:4,overflowY:"auto"}}>
        {filtered.map(k=>(
          <div key={k.id} onClick={()=>setSel(k.id)}
            style={{padding:"12px 14px",background:sel===k.id?`${T.accent}15`:T.surf,border:`1px solid ${sel===k.id?T.accent:T.border}`,borderRadius:5,cursor:"pointer",transition:"all 0.1s"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:14,fontWeight:500}}>{k.naam}</div>
              {!k.user_id&&<span style={{fontSize:10,background:`${T.yellow}20`,color:T.yellow,padding:"1px 6px",borderRadius:3,fontWeight:600}}>Geen account</span>}
            </div>
            <div style={{fontSize:12,color:T.muted,marginTop:3}}>{(k.motoren||[]).length} motor{(k.motoren||[]).length!==1?"en":""} · {k.woonplaats}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if(isMobile){
    return(
      <div>
        {sel&&klant?(
          <KlantDetail
            klant={klant}
            onUpdateKlant={onUpdateKlant}
            onAddMotor={onAddMotor}
            onAddService={onAddService}
            onUpdateService={onUpdateService}
            onDeleteService={onDeleteService}
            onDeleteKlant={onDeleteKlant}
            onUpdateMotorInterval={onUpdateMotorInterval}
            onUitnodig={setUitnodigKlant}
            onBack={()=>setSel(null)}
            isMobile={true}/>
        ):listPanel}
        {modal==="addKlant"&&<KlantModal onSave={onAddKlant} onClose={()=>setModal(null)} voorraad={voorraad}/>}
        {uitnodigKlant&&<UitnodigingModal klant={uitnodigKlant} onClose={()=>setUitnodigKlant(null)}/>}
      </div>
    );
  }

  return(
    <div style={{display:"flex",gap:18,height:"100%"}}>
      <div style={{width:300,flexShrink:0}}>{listPanel}</div>
      <div style={{flex:1,overflowY:"auto"}}>
        {!klant?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:T.muted,fontSize:13}}>← Selecteer een klant</div>
        ):(
          <KlantDetail
            klant={klant}
            onUpdateKlant={onUpdateKlant}
            onAddMotor={onAddMotor}
            onAddService={onAddService}
            onUpdateService={onUpdateService}
            onDeleteService={onDeleteService}
            onDeleteKlant={onDeleteKlant}
            onUpdateMotorInterval={onUpdateMotorInterval}
            onUitnodig={setUitnodigKlant}
            onBack={()=>setSel(null)}
            isMobile={false}/>
        )}
      </div>
      {modal==="addKlant"&&<KlantModal onSave={onAddKlant} onClose={()=>setModal(null)} voorraad={voorraad}/>}
      {uitnodigKlant&&<UitnodigingModal klant={uitnodigKlant} onClose={()=>setUitnodigKlant(null)}/>}
    </div>
  );
}

function VoorraadPage({showroom,onAddMotor,onEditMotor,klanten,onVerkoop,onDelete,onToggleStatus,afspraken,onAddAfspraak}){
  const [modal,setModal]=useState(null);
  const [verkoopMotor,setVerkoopMotor]=useState(null);
  const [verkoopKlant,setVerkoopKlant]=useState("");
  const [lichtbakFoto,setLichtbakFoto]=useState(null);
  const [delMotor,setDelMotor]=useState(null);
  const [editMotor,setEditMotor]=useState(null);
  const [proefritMotor,setProefritMotor]=useState(null);
  const [menuMotorId,setMenuMotorId]=useState(null);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
        <button style={s.btn} onClick={()=>setModal("add")}>+ Motor Toevoegen</button>
      </div>
      {showroom.length===0&&<div style={{color:T.muted,fontSize:13,textAlign:"center",marginTop:60}}>Geen motors in voorraad</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
        {showroom.map(m=>{
          const fotos = Array.isArray(m.fotos) ? m.fotos : [];
          const vbJaren = bandLeeftijd(m.voorband_datum);
          const abJaren = bandLeeftijd(m.achterband_datum);
          const vbStatus = bandStatus(vbJaren);
          const abStatus = bandStatus(abJaren);
          return(
            <div key={m.id} style={s.card}>
              {/* Foto strip */}
              {fotos.length>0&&(
                <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:12,marginLeft:-20,marginRight:-20,paddingLeft:20,paddingRight:20,paddingBottom:2}}>
                  {fotos.map((url,i)=>(
                    <img key={i} src={clImg(url,400)} alt="" onClick={()=>setLichtbakFoto(url)}
                      style={{height:130,width:"auto",objectFit:"cover",borderRadius:4,flexShrink:0,cursor:"pointer",border:`1px solid ${T.border}`}}/>
                  ))}
                </div>
              )}
              {fotos.length===0&&(
                <div style={{height:90,background:T.surf2,borderRadius:4,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",color:T.muted,fontSize:12}}>Geen foto's</div>
              )}

              {/* Motor info */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:18}}>{m.merk} {m.model}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",marginTop:4}}>
                    <span style={{display:"inline-block",padding:"2px 8px",borderRadius:3,fontSize:12,fontWeight:700,background:`${T.yellow}15`,color:T.text,border:`1px solid ${T.yellow}70`,fontFamily:"Barlow Condensed, sans-serif",letterSpacing:1}}>{m.kenteken}</span>
                    {m.chassis_nummer&&(
                      <span style={{fontSize:11,color:T.muted,fontFamily:"Barlow Condensed, sans-serif",letterSpacing:0.5}}>
                        {m.chassis_nummer.slice(0,-4)}<span style={{color:T.yellow,fontWeight:700}}>{m.chassis_nummer.slice(-4)}</span>
                      </span>
                    )}
                    {m.status==="gereserveerd"&&<span style={{...s.badge(T.yellow),fontSize:10}}>Gereserveerd</span>}
                    {m.status==="niet_beschikbaar"&&<span style={{...s.badge(T.muted),fontSize:10}}>Niet beschikbaar</span>}
                  </div>
                </div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:22,color:T.accent,flexShrink:0}}>€{m.prijs.toLocaleString()}</div>
              </div>
              <div style={{fontSize:12,color:T.muted,lineHeight:1.8,marginBottom:10}}>
                {m.bouwjaar} · {m.km.toLocaleString()} km · Binnen: {m.datum_in}
              </div>

              {/* Bandendatums */}
              {(m.voorband_datum||m.achterband_datum)&&(
                <div style={{background:T.surf2,borderRadius:4,padding:"8px 10px",marginBottom:10,fontSize:12}}>
                  {m.voorband_datum&&(
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:m.achterband_datum?4:0}}>
                      <span style={{color:T.muted,minWidth:70}}>Voorband:</span>
                      <BandTag datum={m.voorband_datum}/>
                    </div>
                  )}
                  {m.achterband_datum&&(
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{color:T.muted,minWidth:70}}>Achterband:</span>
                      <BandTag datum={m.achterband_datum}/>
                    </div>
                  )}
                </div>
              )}

              {/* Acties */}
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <button onClick={()=>{setVerkoopMotor(m);setVerkoopKlant("");}} style={{...s.btnOutline,flex:1}}
                  disabled={m.status==="niet_beschikbaar"}>
                  Verkopen aan klant →
                </button>
                <button onClick={()=>{setProefritMotor(m);setMenuMotorId(null);}} title="Proefrit inboeken"
                  style={{padding:"8px 11px",background:"none",border:`1px solid ${T.green}`,borderRadius:3,color:T.green,cursor:"pointer",fontSize:16,fontFamily:"Barlow, sans-serif",flexShrink:0}}>
                  🏍
                </button>
                <div style={{position:"relative",flexShrink:0}}>
                  <button onClick={()=>setMenuMotorId(v=>v===m.id?null:m.id)}
                    style={{padding:"8px 11px",background:"none",border:`1px solid ${T.border}`,borderRadius:3,color:T.muted,cursor:"pointer",fontSize:18,fontFamily:"Barlow, sans-serif",height:"100%",lineHeight:1}}>
                    ⋮
                  </button>
                  {menuMotorId===m.id&&(
                    <>
                      <div style={{position:"fixed",inset:0,zIndex:99}} onClick={()=>setMenuMotorId(null)}/>
                      <div style={{position:"absolute",right:0,top:"100%",marginTop:4,background:T.surf2,border:`1px solid ${T.border}`,borderRadius:6,minWidth:200,zIndex:100,boxShadow:"0 4px 20px #0009",overflow:"hidden"}}>
                        <button onClick={()=>{setEditMotor(m);setMenuMotorId(null);}} style={{display:"block",width:"100%",padding:"11px 14px",background:"none",border:"none",color:T.text,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",textAlign:"left"}}>Wijzigen</button>
                        {m.status!=="gereserveerd"&&(
                          <button onClick={()=>{onToggleStatus(m.id,"gereserveerd");setMenuMotorId(null);}} style={{display:"block",width:"100%",padding:"11px 14px",background:"none",border:"none",color:T.yellow,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",textAlign:"left"}}>Reserveren</button>
                        )}
                        {m.status==="gereserveerd"&&(
                          <button onClick={()=>{onToggleStatus(m.id,"beschikbaar");setMenuMotorId(null);}} style={{display:"block",width:"100%",padding:"11px 14px",background:"none",border:"none",color:T.green,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",textAlign:"left"}}>Terug beschikbaar</button>
                        )}
                        <button onClick={()=>{onToggleStatus(m.id,m.status==="beschikbaar"?"niet_beschikbaar":"beschikbaar");setMenuMotorId(null);}} style={{display:"block",width:"100%",padding:"11px 14px",background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",textAlign:"left"}}>
                          {m.status==="beschikbaar"?"Uit verkoop halen":"Terug in verkoop"}
                        </button>
                        <div style={{height:1,background:T.border}}/>
                        <button onClick={()=>{setDelMotor(m);setMenuMotorId(null);}} style={{display:"block",width:"100%",padding:"11px 14px",background:"none",border:"none",color:T.red,fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",textAlign:"left"}}>Verwijderen</button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Platform knoppen */}
              <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10}}>
                <div style={{fontSize:10,color:T.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Publiceren op</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[{naam:"Motoroccasion.nl",kleur:"#1a6bc4"},{naam:"Autoscout24.nl",kleur:"#f50c30"},{naam:"Marktplaats.nl",kleur:"#ed7d00"}].map(p=>(
                    <button key={p.naam} title="Binnenkort beschikbaar"
                      style={{padding:"6px 10px",fontSize:11,fontWeight:600,background:"transparent",border:`1px solid ${T.border}`,borderRadius:3,color:T.muted,cursor:"not-allowed",fontFamily:"Barlow, sans-serif",opacity:0.6}}>
                      {p.naam} ↗
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal==="add"&&<VoorraadModal onSave={onAddMotor} onClose={()=>setModal(null)}/>}
      {editMotor&&<VoorraadEditModal motor={editMotor} onSave={onEditMotor} onClose={()=>setEditMotor(null)}/>}
      {proefritMotor&&<ProefritModal motor={proefritMotor} afspraken={afspraken||[]} onSave={f=>{onAddAfspraak(f);setProefritMotor(null);}} onClose={()=>setProefritMotor(null)}/>}

      {/* Lichtbak voor foto's */}
      {lichtbakFoto&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20}} onClick={()=>setLichtbakFoto(null)}>
          <img src={clImg(lichtbakFoto,1600)} alt="" style={{maxWidth:"100%",maxHeight:"90vh",objectFit:"contain",borderRadius:4}}/>
          <button onClick={()=>setLichtbakFoto(null)} style={{position:"absolute",top:16,right:20,background:"none",border:"none",color:"#fff",fontSize:28,cursor:"pointer"}}>✕</button>
        </div>
      )}

      {verkoopMotor&&(
        <Modal title="MOTOR VERKOPEN" onClose={()=>setVerkoopMotor(null)}>
          <div style={{marginBottom:16,padding:14,background:T.surf2,borderRadius:4}}>
            <div style={{fontSize:14,fontWeight:500}}>{verkoopMotor.merk} {verkoopMotor.model} — {verkoopMotor.kenteken}</div>
            <div style={{fontSize:12,color:T.muted,marginTop:4}}>Vraagprijs: €{verkoopMotor.prijs.toLocaleString()}</div>
          </div>
          <Field label="Verkopen aan">
            <select style={s.input} value={verkoopKlant} onChange={e=>setVerkoopKlant(e.target.value)}>
              <option value="">— Selecteer klant —</option>
              {klanten.map(k=><option key={k.id} value={k.id}>{k.naam}</option>)}
            </select>
          </Field>
          <ModalFooter onClose={()=>setVerkoopMotor(null)} label="Verkopen"
            onClick={()=>{if(verkoopKlant){onVerkoop(verkoopMotor,verkoopKlant);setVerkoopMotor(null);}}}/>
        </Modal>
      )}

      {delMotor&&(
        <Modal title="MOTOR VERWIJDEREN" onClose={()=>setDelMotor(null)}>
          <div style={{padding:"14px 0 10px"}}>
            <div style={{fontSize:14,marginBottom:6}}>{delMotor.merk} {delMotor.model} — <span style={{fontFamily:"Barlow Condensed, sans-serif",letterSpacing:1}}>{delMotor.kenteken}</span></div>
            <div style={{fontSize:13,color:T.muted}}>
              Dit verwijdert de motor uit de voorraad.
              {(delMotor.fotos||[]).length>0&&<> De {delMotor.fotos.length} foto{delMotor.fotos.length>1?"'s":""} worden ook verwijderd uit Cloudinary.</>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
            <button onClick={()=>setDelMotor(null)} style={{...s.btnOutline,padding:"8px 14px"}}>Annuleer</button>
            <button onClick={()=>{onDelete(delMotor);setDelMotor(null);}} style={{background:T.red,color:"#fff",border:"none",borderRadius:3,padding:"8px 16px",fontSize:13,cursor:"pointer",fontFamily:"Barlow, sans-serif",fontWeight:600}}>
              Ja, verwijderen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AfspraakEditModal({afspraak, klanten, voorraad, onSave, onDelete, onClose}){
  const isAanvraag=afspraak.status==="aangevraagd";
  const isProefrit=afspraak.type==="proefrit";
  const [f,setF]=useState({
    klant: afspraak.klant||"",
    naam: afspraak.naam||"",
    datum: afspraak.datum||TODAY,
    tijd: afspraak.tijd||"09:00",
    duur: String(afspraak.duur||1),
    omschrijving: afspraak.omschrijving||afspraak.opmerking||"",
    voorraad_motor_id: afspraak.voorraad_motor_id||"",
  });
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));
  const motorInfo=isProefrit&&afspraak.voorraad_motor_id?(voorraad||[]).find(m=>m.id===afspraak.voorraad_motor_id):null;
  return(
    <Modal title={isAanvraag?"AANVRAAG INPLANNEN":isProefrit?"PROEFRIT WIJZIGEN":"AFSPRAAK WIJZIGEN"} onClose={onClose}>
      {isProefrit&&(
        <div style={{background:`${T.green}15`,border:`1px solid ${T.green}40`,borderRadius:5,padding:"8px 12px",marginBottom:14,fontSize:13,color:T.green,display:"flex",alignItems:"center",gap:6}}>
          🏍 Proefrit{motorInfo?` · ${motorInfo.merk} ${motorInfo.model} (${motorInfo.kenteken})`:""}
        </div>
      )}
      {isAanvraag&&!isProefrit&&(
        <div style={{background:`${T.yellow}15`,border:`1px solid ${T.yellow}40`,borderRadius:5,padding:"10px 14px",marginBottom:16,fontSize:13,color:T.yellow}}>
          📋 Aanvraag van klant — stel tijd en duur in om te bevestigen.
          {(afspraak.opmerking||afspraak.omschrijving)&&(
            <div style={{marginTop:6,color:T.text,fontSize:12}}>Opmerking: {afspraak.opmerking||afspraak.omschrijving}</div>
          )}
        </div>
      )}
      {isProefrit?(
        <Field label="Naam proefrijder">
          <input style={s.input} value={f.naam} onChange={set("naam")} placeholder="Naam"/>
        </Field>
      ):(
        <Field label="Klant">
          <select style={s.input} value={f.klant} onChange={set("klant")}>
            <option value="">— Selecteer klant —</option>
            {klanten.map(k=><option key={k.id}>{k.naam}</option>)}
            <option value="Walk-in">Walk-in</option>
          </select>
        </Field>
      )}
      <Grid2>
        <Field label="Datum"><input style={s.input} type="date" value={f.datum} onChange={set("datum")}/></Field>
        <Field label="Starttijd"><input style={s.input} type="time" value={f.tijd} onChange={set("tijd")}/></Field>
        <Field label="Duur (uur)">
          <select style={s.input} value={f.duur} onChange={set("duur")}>
            {[1,2,3,4,5,6,7,8].map(h=><option key={h}>{h}</option>)}
          </select>
        </Field>
      </Grid2>
      <Field label="Opmerkingen">
        <textarea style={{...s.input,height:70,resize:"none"}} value={f.omschrijving} onChange={e=>setF(p=>({...p,omschrijving:e.target.value}))}/>
      </Field>
      <div style={{display:"flex",gap:10,justifyContent:"space-between",marginTop:20,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
        <button style={{...s.btn,background:T.red,flex:"0 0 auto"}} onClick={()=>onDelete(afspraak.id)}>Verwijderen</button>
        <div style={{display:"flex",gap:10}}>
          <button style={s.btnGhost} onClick={onClose}>Annuleer</button>
          <button style={s.btn} onClick={()=>onSave({...afspraak,...f,duur:parseInt(f.duur)})}>Opslaan</button>
        </div>
      </div>
    </Modal>
  );
}

function AgendaPage({afspraken,klanten,voorraad,onAddAfspraak,onEditAfspraak,onDeleteAfspraak,geslotenDagen=[],onToggleGesloten,openingstijden}){
  const isMobile=useIsMobile();
  const [weekBase,setWeekBase]=useState(TODAY);
  const [modal,setModal]=useState(false);
  const [editAfspraak,setEditAfspraak]=useState(null);
  const [dragId,setDragId]=useState(null);
  const [selDay,setSelDay]=useState(TODAY);
  // Splits geplande vs aangevraagde afspraken
  const geplandAfspraken=afspraken.filter(a=>a.status!=="aangevraagd");
  const aanvragen=afspraken.filter(a=>a.status==="aangevraagd").sort((a,b)=>a.datum.localeCompare(b.datum));
  const weekDates=getWeekDates(weekBase);
  const prev=()=>{const d=new Date(weekDates[0]);d.setDate(d.getDate()-7);setWeekBase(d.toISOString().split("T")[0]);};
  const next=()=>{const d=new Date(weekDates[0]);d.setDate(d.getDate()+7);setWeekBase(d.toISOString().split("T")[0]);};
  const HOURS=Array.from({length:9},(_,i)=>i+9);
  const CAL_H=440; const TOTAL_MIN=WEND-WSTART;

  // Dag gesloten op basis van instellingen openingstijden
  const DAGMAP=["zo","ma","di","wo","do","vr","za"];
  const isDagGesloten=(datum)=>{
    if(geslotenDagen.includes(datum)) return true;
    if(openingstijden){
      const dow=new Date(datum).getDay();
      const dagKey=DAGMAP[dow];
      return openingstijden[dagKey]?.gesloten===true;
    }
    return false;
  };

  const handleDrop=(datum,e)=>{
    e.preventDefault();
    if(!dragId) return;
    const afs=afspraken.find(a=>a.id===dragId);
    if(afs && afs.datum!==datum) onEditAfspraak({...afs,datum});
    setDragId(null);
  };

  // ── Mobile day-list view ─────────────────────────────────────────────────
  if(isMobile){
    const dayApts=geplandAfspraken.filter(a=>a.datum===selDay).sort((a,b)=>(a.tijd||"").localeCompare(b.tijd||""));
    const gesloten=isDagGesloten(selDay);
    return(
      <div>
        {/* Week strip */}
        <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:16,paddingBottom:4}}>
          {weekDates.map((d,i)=>{
            const cnt=geplandAfspraken.filter(a=>a.datum===d).length;
            const isGesloten=isDagGesloten(d);
            return(
              <button key={d} onClick={()=>setSelDay(d)} style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 12px",borderRadius:6,border:`1px solid ${d===selDay?T.accent:T.border}`,background:d===selDay?`${T.accent}20`:"transparent",color:isGesloten?T.red:d===selDay?T.accent:T.muted,cursor:"pointer",fontFamily:"Barlow, sans-serif"}}>
                <span style={{fontSize:10,fontWeight:600}}>{DAYS_NL[i]}</span>
                <span style={{fontSize:14,fontWeight:d===TODAY?700:500,color:d===TODAY&&d!==selDay?T.text:"inherit"}}>{fmtDate(d)}</span>
                {cnt>0&&<span style={{width:6,height:6,borderRadius:"50%",background:d===selDay?"#fff":T.accent,display:"block"}}/>}
              </button>
            );
          })}
        </div>
        {/* Nav */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{display:"flex",gap:6}}>
            <button style={s.btnGhost} onClick={prev}>← Week</button>
            <button style={s.btnGhost} onClick={next}>Week →</button>
          </div>
          <button style={s.btn} onClick={()=>setModal(true)}>+ Afspraak</button>
        </div>
        {/* Day appointments */}
        {gesloten?(
          <div style={{...s.card,textAlign:"center",color:T.red,fontSize:13,padding:20}}>GESLOTEN</div>
        ):dayApts.length===0?(
          <div style={{color:T.muted,fontSize:13,textAlign:"center",padding:"30px 0"}}>Geen afspraken op {fmtDate(selDay)}</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {dayApts.map(a=>{
              const kleur=a.type==="proefrit"?T.green:T.accent;
              const naam=a.type==="proefrit"?(a.naam||a.klant):a.klant;
              const sub=a.type==="proefrit"?(a.motorLabel||"🏍 proefrit"):(a.omschrijving||a.opmerking||"");
              return(
                <div key={a.id} onClick={()=>setEditAfspraak(a)} style={{...s.card,display:"flex",gap:12,alignItems:"flex-start",padding:"12px 14px",cursor:"pointer",border:`1px solid ${kleur}40`}}>
                  <div style={{background:kleur,color:"#fff",padding:"4px 8px",borderRadius:3,fontSize:13,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{a.tijd||"—"}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:600}}>{naam}</div>
                    <div style={{fontSize:12,color:T.muted,marginTop:2}}>{sub} · {a.duur}u</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* Aanvragen */}
        {aanvragen.length>0&&(
          <div style={{marginTop:20}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:14,letterSpacing:1,textTransform:"uppercase",color:T.yellow,marginBottom:10}}>
              Aanvragen ({aanvragen.length})
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {aanvragen.map(a=>(
                <div key={a.id} style={{...s.card,padding:"12px 14px",border:`1px solid ${T.yellow}35`,background:`${T.yellow}08`}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{a.klant||"Onbekende klant"} · {a.datum}</div>
                  {(a.opmerking||a.omschrijving)&&<div style={{fontSize:12,color:T.muted,marginBottom:8}}>{a.opmerking||a.omschrijving}</div>}
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...s.btn,flex:1,padding:"8px"}} onClick={()=>setEditAfspraak(a)}>Inplannen</button>
                    <button style={{...s.btn,flex:1,padding:"8px",background:T.red}} onClick={()=>onDeleteAfspraak(a.id)}>Afwijzen</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {modal&&<AfspraakModal afspraken={geplandAfspraken} klanten={klanten} onSave={a=>{onAddAfspraak(a);setModal(false);}} onClose={()=>setModal(false)}/>}
        {editAfspraak&&(
          <AfspraakEditModal afspraak={editAfspraak} klanten={klanten} voorraad={voorraad}
            onSave={a=>{onEditAfspraak(a);setEditAfspraak(null);}}
            onDelete={id=>{onDeleteAfspraak(id);setEditAfspraak(null);}}
            onClose={()=>setEditAfspraak(null)}/>
        )}
      </div>
    );
  }

  // ── Desktop week-grid view ────────────────────────────────────────────────
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button style={s.btnGhost} onClick={prev}>← Vorige</button>
          <span style={{fontSize:13,color:T.muted,minWidth:120,textAlign:"center"}}>{fmtDate(weekDates[0])} – {fmtDate(weekDates[5])}</span>
          <button style={s.btnGhost} onClick={next}>Volgende →</button>
        </div>
        <button style={s.btn} onClick={()=>setModal(true)}>+ Afspraak</button>
      </div>

      <div style={{...s.card,padding:0,overflow:"hidden"}}>
        {/* Dag headers */}
        <div style={{display:"grid",gridTemplateColumns:"44px repeat(6,1fr)",borderBottom:`1px solid ${T.border}`}}>
          <div/>
          {weekDates.map((d,i)=>{
            const gesloten=isDagGesloten(d);
            return(
              <div key={d} style={{padding:"10px 6px",textAlign:"center",borderLeft:`1px solid ${T.border}`,background:gesloten?`${T.red}10`:d===TODAY?`${T.accent}18`:"transparent"}}>
                <div style={{fontSize:10,color:T.muted,letterSpacing:1}}>{DAYS_NL[i]}</div>
                <div style={{fontSize:13,fontWeight:d===TODAY?700:400,color:gesloten?T.red:d===TODAY?T.accent:T.text,marginTop:2}}>{fmtDate(d)}</div>
                {gesloten
                  ? <div style={{fontSize:9,color:T.red,marginTop:2}}>GESLOTEN</div>
                  : <div style={{fontSize:9,color:T.muted,marginTop:2}}>
                      {openingstijden&&!openingstijden[DAGMAP[new Date(d).getDay()]]?.gesloten
                        ? `${openingstijden[DAGMAP[new Date(d).getDay()]]?.open||"09:00"}–${openingstijden[DAGMAP[new Date(d).getDay()]]?.sluit||"17:00"}`
                        : "09:00–17:00"}
                    </div>
                }
                {/* Dag blokkeren / deblokkeren bij klik */}
                <div onClick={()=>onToggleGesloten(d, !geslotenDagen.includes(d))}
                  style={{fontSize:9,color:geslotenDagen.includes(d)?T.green:T.muted,cursor:"pointer",marginTop:2,textDecoration:"underline"}}>
                  {geslotenDagen.includes(d)?"deblokkeer":"blokkeer"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tijdrooster */}
        <div style={{display:"grid",gridTemplateColumns:"44px repeat(6,1fr)",height:CAL_H}}>
          <div style={{position:"relative",borderRight:`1px solid ${T.border}`}}>
            {HOURS.map(h=>(
              <div key={h} style={{position:"absolute",top:`${(h-9)/8*100}%`,right:6,fontSize:10,color:T.muted,transform:"translateY(-50%)"}}>
                {h}:00
              </div>
            ))}
          </div>

          {weekDates.map((d)=>{
            const apts=geplandAfspraken.filter(a=>a.datum===d);
            const gesloten=isDagGesloten(d);
            return(
              <div key={d}
                style={{borderLeft:`1px solid ${T.border}`,position:"relative",background:gesloten?`${T.red}06`:d===TODAY?`${T.accent}04`:"transparent"}}
                onDragOver={e=>{e.preventDefault();}}
                onDrop={e=>handleDrop(d,e)}>
                {HOURS.map(h=>(
                  <div key={h} style={{position:"absolute",top:`${(h-9)/8*100}%`,left:0,right:0,borderTop:`1px solid ${T.border}18`}}/>
                ))}
                {gesloten&&(
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                    <div style={{fontSize:11,color:T.red,fontWeight:600,opacity:0.6}}>GESLOTEN</div>
                  </div>
                )}
                {apts.map(a=>{
                  const startMin=timeToMin(a.tijd||"09:00")-WSTART;
                  const top=Math.max(0,startMin/TOTAL_MIN*100);
                  const height=Math.min((a.duur||1)*60/TOTAL_MIN*100,100-top);
                  const kleur=a.type==="proefrit"?T.green:T.accent;
                  const displayNaam=a.type==="proefrit"?(a.naam||a.klant):a.klant;
                  const displaySub=a.type==="proefrit"?(a.motorLabel||"🏍 proefrit"):(a.omschrijving||a.opmerking||"");
                  return(
                    <div key={a.id}
                      draggable
                      onDragStart={()=>setDragId(a.id)}
                      onDragEnd={()=>setDragId(null)}
                      onClick={()=>setEditAfspraak(a)}
                      style={{position:"absolute",top:`${top}%`,height:`${height}%`,left:3,right:3,
                        background:dragId===a.id?`${kleur}15`:`${kleur}28`,
                        border:`1px solid ${kleur}80`,borderRadius:4,padding:"4px 6px",
                        overflow:"hidden",cursor:"grab",userSelect:"none",
                        boxShadow:dragId===a.id?"0 2px 8px rgba(0,0,0,0.4)":"none",
                        transition:"opacity 0.1s"}}>
                      <div style={{fontSize:11,fontWeight:700,color:kleur}}>{a.tijd}</div>
                      <div style={{fontSize:10,color:T.text,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayNaam}</div>
                      {height>8&&<div style={{fontSize:10,color:T.muted}}>{a.duur}u · {displaySub}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{fontSize:11,color:T.muted,marginTop:8}}>💡 Klik een afspraak om te wijzigen · Sleep naar een andere dag</div>

      {/* Aanvragen van klanten */}
      {aanvragen.length>0&&(
        <div style={{marginTop:20}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:1,textTransform:"uppercase",color:T.yellow}}>
              Aanvragen klanten
            </div>
            <span style={{...s.badge(T.yellow),fontSize:11}}>{aanvragen.length}</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {aanvragen.map(a=>(
              <div key={a.id} style={{...s.card,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",border:`1px solid ${T.yellow}35`,background:`${T.yellow}08`}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{...s.badge(T.yellow),fontSize:10}}>Aanvraag</span>
                    <span style={{fontSize:13,fontWeight:600}}>{a.klant||"Onbekende klant"}</span>
                    <span style={{fontSize:12,color:T.muted}}>· {a.datum}</span>
                  </div>
                  {(a.opmerking||a.omschrijving)&&(
                    <div style={{fontSize:12,color:T.muted}}>{a.opmerking||a.omschrijving}</div>
                  )}
                </div>
                <div style={{display:"flex",gap:8,flexShrink:0,marginLeft:16}}>
                  <button style={{...s.btn,background:T.accent}} onClick={()=>setEditAfspraak(a)}>
                    Inplannen
                  </button>
                  <button style={{...s.btn,background:T.red}} onClick={()=>onDeleteAfspraak(a.id)}>
                    Afwijzen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal&&<AfspraakModal afspraken={geplandAfspraken} klanten={klanten} onSave={a=>{onAddAfspraak(a);setModal(false);}} onClose={()=>setModal(false)}/>}
      {editAfspraak&&(
        <AfspraakEditModal
          afspraak={editAfspraak}
          klanten={klanten}
          voorraad={voorraad}
          onSave={a=>{onEditAfspraak(a);setEditAfspraak(null);}}
          onDelete={id=>{onDeleteAfspraak(id);setEditAfspraak(null);}}
          onClose={()=>setEditAfspraak(null)}/>
      )}
    </div>
  );
}

// ── App Root ─────────────────────────────────────────────────────────────────
// ── Instellingen Page ─────────────────────────────────────────────────────────
const DAGEN = ["ma","di","wo","do","vr","za","zo"];
const DAG_LABELS = {ma:"Maandag",di:"Dinsdag",wo:"Woensdag",do:"Donderdag",vr:"Vrijdag",za:"Zaterdag",zo:"Zondag"};
const DEFAULT_TIJDEN = {
  ma:{open:"09:00",sluit:"17:00",gesloten:false}, di:{open:"09:00",sluit:"17:00",gesloten:false},
  wo:{open:"09:00",sluit:"17:00",gesloten:false}, do:{open:"09:00",sluit:"17:00",gesloten:false},
  vr:{open:"09:00",sluit:"17:00",gesloten:false}, za:{open:"10:00",sluit:"15:00",gesloten:false},
  zo:{open:"",sluit:"",gesloten:true}
};

function InstellingenPage({openingstijden,geslotenDagen,onSaveTijden,onToggleGesloten,opmerking="",onSaveOpmerking}){
  const [tijden,setTijden]=useState(openingstijden||DEFAULT_TIJDEN);
  const [opgeslagen,setOpgeslagen]=useState(false);
  const [opmTekst,setOpmTekst]=useState(opmerking);
  const [opmOpgeslagen,setOpmOpgeslagen]=useState(false);
  useEffect(()=>{ setOpmTekst(opmerking); },[opmerking]);
  const [periodeVan,setPeriodeVan]=useState("");
  const [periodeTot,setPeriodeTot]=useState("");

  useEffect(()=>{ if(openingstijden) setTijden(openingstijden); },[openingstijden]);

  const setDag=(dag,veld,waarde)=>setTijden(p=>({...p,[dag]:{...p[dag],[veld]:waarde}}));

  const opslaan=async()=>{
    await onSaveTijden(tijden);
    setOpgeslagen(true);
    setTimeout(()=>setOpgeslagen(false),2000);
  };

  // Genereer alle datums in een periode
  const voegPeriodeToe = () => {
    if(!periodeVan||!periodeTot||periodeVan>periodeTot) return;
    const datums = [];
    const cur = new Date(periodeVan);
    const end = new Date(periodeTot);
    while(cur <= end) {
      datums.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate()+1);
    }
    datums.forEach(d => onToggleGesloten(d, true));
    setPeriodeVan(""); setPeriodeTot("");
  };

  const geslotenGesorteeerd = [...geslotenDagen].sort();

  const slaOpmOp = async () => {
    await onSaveOpmerking(opmTekst);
    setOpmOpgeslagen(true);
    setTimeout(()=>setOpmOpgeslagen(false),2000);
  };

  return(
    <div style={{maxWidth:600}}>
      {/* Bericht aan klanten */}
      <div style={{...s.card,marginBottom:16}}>
        <div style={s.sectionLabel}>Bericht aan klanten</div>
        <div style={{fontSize:12,color:T.muted,marginBottom:12}}>
          Dit bericht verschijnt in het rood op de contactpagina van klanten. Leeg laten = geen bericht.
        </div>
        <textarea style={{...s.input,height:80,resize:"vertical",fontFamily:"Barlow, sans-serif"}}
          value={opmTekst} onChange={e=>setOpmTekst(e.target.value)}
          placeholder='Bijv. "Wegens de warmte sluiten wij vandaag om 15:00 uur."'/>
        <div style={{marginTop:10,display:"flex",justifyContent:"flex-end",gap:10}}>
          {opmTekst&&<button style={{...s.btnGhost,width:"auto",padding:"7px 14px"}} onClick={()=>{ setOpmTekst(""); onSaveOpmerking(""); }}>Wissen</button>}
          <button style={{...s.btn,background:opmOpgeslagen?T.green:T.accent,width:"auto",padding:"9px 20px"}} onClick={slaOpmOp}>
            {opmOpgeslagen?"✓ Opgeslagen!":"Opslaan"}
          </button>
        </div>
      </div>

      {/* Openingstijden */}
      <div style={{...s.card,marginBottom:16}}>
        <div style={s.sectionLabel}>Openingstijden</div>
        <div style={{fontSize:12,color:T.muted,marginBottom:16}}>Klanten zien dit bij Contact.</div>
        {DAGEN.map(dag=>(
          <div key={dag} style={{display:"grid",gridTemplateColumns:"120px 1fr",gap:12,alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
            <div style={{fontSize:13,fontWeight:500}}>{DAG_LABELS[dag]}</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
                <input type="checkbox" checked={tijden[dag]?.gesloten||false}
                  onChange={e=>setDag(dag,"gesloten",e.target.checked)} style={{accentColor:T.accent}}/>
                <span style={{fontSize:12,color:T.muted}}>Gesloten</span>
              </label>
              {!tijden[dag]?.gesloten&&(
                <>
                  <input style={{...s.input,width:80,padding:"6px 8px",fontSize:13}} type="time"
                    value={tijden[dag]?.open||""} onChange={e=>setDag(dag,"open",e.target.value)}/>
                  <span style={{fontSize:12,color:T.muted}}>–</span>
                  <input style={{...s.input,width:80,padding:"6px 8px",fontSize:13}} type="time"
                    value={tijden[dag]?.sluit||""} onChange={e=>setDag(dag,"sluit",e.target.value)}/>
                </>
              )}
            </div>
          </div>
        ))}
        <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
          <button style={{...s.btn,background:opgeslagen?T.green:T.accent,width:"auto",padding:"9px 20px"}} onClick={opslaan}>
            {opgeslagen?"✓ Opgeslagen!":"Opslaan"}
          </button>
        </div>
      </div>

      {/* Gesloten periodes */}
      <div style={s.card}>
        <div style={s.sectionLabel}>Gesloten periodes</div>
        <div style={{fontSize:12,color:T.muted,marginBottom:16}}>Vakantie, feestdagen, en andere gesloten dagen. Klanten kunnen op deze dagen geen afspraak plannen.</div>

        {/* Bestaande periodes */}
        {geslotenGesorteeerd.length===0 ? (
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Nog geen periodes ingesteld.</div>
        ) : geslotenGesorteeerd.map((d,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.border}`}}>
            <div style={{fontSize:13}}>{fmtDate(d)} — {new Date(d+"T00:00:00").toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long"})}</div>
            <button onClick={()=>onToggleGesloten(d, false)} style={{background:"none",border:`1px solid ${T.red}`,color:T.red,borderRadius:4,padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"Barlow, sans-serif",flexShrink:0,marginLeft:8}}>
              Verwijder
            </button>
          </div>
        ))}

        {/* Nieuwe periode toevoegen */}
        <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
          <div style={{fontSize:12,color:T.muted,marginBottom:10}}>Periode toevoegen</div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:12,color:T.muted}}>Van</span>
              <input style={{...s.input,width:140,marginBottom:0,padding:"7px 10px"}} type="date" value={periodeVan} onChange={e=>setPeriodeVan(e.target.value)} min={TODAY}/>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:12,color:T.muted}}>t/m</span>
              <input style={{...s.input,width:140,marginBottom:0,padding:"7px 10px"}} type="date" value={periodeTot} onChange={e=>setPeriodeTot(e.target.value)} min={periodeVan||TODAY}/>
            </div>
            <button style={{...s.btn,width:"auto",padding:"8px 16px",background:T.accent}} onClick={voegPeriodeToe}>
              Toevoegen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminApp(){
  const isMobile=useIsMobile();
  const [page,setPage]=useState("dashboard");
  const [klanten,setKlanten]=useState([]);
  const [showroom,setShowroom]=useState([]);
  const [afspraken,setAfspraken]=useState([]);
  const [laden,setLaden]=useState(true);

  // ── Data ophalen bij laden ──────────────────────────────────
  useEffect(()=>{
    const laadAlles = async () => {
      try {
        const sb = (await import("../lib/supabase.js")).supabase;
        const [k, v, a, verlopen] = await Promise.all([
          sb.from("klanten").select("*").order("naam"),
          sb.from("voorraad").select("*").is("verkocht_op",null).order("created_at",{ascending:false}),
          sb.from("afspraken").select("*, klanten(naam), motoren(merk, model, kenteken)").order("datum"),
          sb.from("voorraad").select("id,fotos").lte("fotos_bewaren_tot",TODAY).not("fotos","eq","[]"),
        ]);
        // Cleanup verlopen foto's (>30 dagen na verkoop)
        for(const m of (verlopen.data||[])){
          const urls=(m.fotos||[]).filter(Boolean);
          if(urls.length){ sb.functions.invoke("cloudinary-delete",{body:{urls}}); await sb.from("voorraad").update({fotos:[]}).eq("id",m.id); }
        }

        const klantIds = (k.data||[]).map(x=>x.id);
        let verrijkt = (k.data||[]).map(klant=>({...klant, motoren:[]}));

        if(klantIds.length > 0){
          const [mot, km, svc] = await Promise.all([
            sb.from("motoren").select("*").in("klant_id",klantIds),
            sb.from("km_historie").select("*").order("datum"),
            sb.from("service_beurten").select("*").order("datum",{ascending:false}),
          ]);
          const motoren = mot.data||[];
          const kmHist = km.data||[];
          const svcBeurten = svc.data||[];
          verrijkt = (k.data||[]).map(klant=>({
            ...klant,
            motoren: motoren.filter(m=>m.klant_id===klant.id).map(m=>({
              ...m,
              kmHistory: kmHist.filter(x=>x.motor_id===m.id).map(x=>({datum:x.datum,km:x.km})),
              service: svcBeurten.filter(x=>x.motor_id===m.id).map(x=>({id:x.id,datum:x.datum,omschrijving:x.omschrijving,km:x.km})),
            }))
          }));
        }

        setKlanten(verrijkt);
        setShowroom(v.data||[]);
        setAfspraken((a.data||[]).map(x=>{
          const isProefrit=x.type==="proefrit";
          const proefritMotor=isProefrit&&x.voorraad_motor_id?(v.data||[]).find(m=>m.id===x.voorraad_motor_id):null;
          return{...x,
            klant:isProefrit?(x.naam||"Proefrit"):x.klanten?.naam||"Onbekend",
            naam:x.naam||"",
            motorLabel:isProefrit&&proefritMotor?`${proefritMotor.merk} ${proefritMotor.model}`:(x.motoren?[x.motoren.merk,x.motoren.model].filter(Boolean).join(" ")||null:null),
          };
        }));

        // Instellingen laden
        const inst = await sb.from("instellingen").select("gesloten_dagen,openingstijden,opmerking").single();
        if(inst.data?.gesloten_dagen) setGeslotenDagen(inst.data.gesloten_dagen);
        if(inst.data?.openingstijden) setOpeningstijden(inst.data.openingstijden);
        if(inst.data?.opmerking !== undefined) setOpmerking(inst.data.opmerking || "");

      } catch(e) {
        console.error("Laad fout:", e);
      } finally {
        setLaden(false);
      }
    };

    // Maximaal 10 seconden — daarna toch doorgaan
    const timer = setTimeout(()=>setLaden(false), 10000);
    laadAlles().then(()=>clearTimeout(timer));
  },[]);

  // ── Mutaties ───────────────────────────────────────────────
  const addKlant = async (f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const {data:klant} = await sb.from("klanten").insert({
      naam:f.naam, email:f.email, telefoon:f.telefoon||"",
      adres:f.adres||"", postcode:f.postcode||"", woonplaats:f.woonplaats||""
    }).select().single();
    if(!klant) return;
    let motoren = [];
    if(f.motor){
      const src = f.motor;
      const {data:motor} = await sb.from("motoren").insert({
        klant_id:klant.id, kenteken:src.kenteken||"", merk:src.merk||"",
        model:src.model||"", bouwjaar:parseInt(src.bouwjaar)||0,
        aankoopdatum:src.aankoopdatum||TODAY,
      }).select().single();
      if(motor){
        if(src.km){ await sb.from("km_historie").insert({motor_id:motor.id,km:parseInt(src.km),datum:TODAY}); }
        motoren = [{...motor,kmHistory:src.km?[{datum:TODAY,km:parseInt(src.km)}]:[],service:[]}];
        if(f.verwijderUitVoorraad){
          await sb.from("voorraad").update({verkocht_op:TODAY,verkocht_aan:klant.id}).eq("id",f.verwijderUitVoorraad);
          setShowroom(p=>p.filter(m=>m.id!==f.verwijderUitVoorraad));
        }
      }
    }
    setKlanten(p=>[...p,{...klant,motoren}]);
  };

  const updateKlant = async (u) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    await sb.from("klanten").update({
      naam:u.naam, email:u.email, telefoon:u.telefoon,
      adres:u.adres, postcode:u.postcode, woonplaats:u.woonplaats,
      status:u.status||"goedgekeurd"
    }).eq("id",u.id);
    setKlanten(p=>p.map(k=>k.id===u.id?u:k));
  };

  const addMotorAanKlant = async (klantId, f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const {data:motor} = await sb.from("motoren").insert({
      klant_id:klantId, kenteken:f.kenteken||"", merk:f.merk||"",
      model:f.model||"", bouwjaar:parseInt(f.bouwjaar)||0,
      aankoopdatum:f.aankoopdatum||TODAY,
    }).select().single();
    if(!motor) return;
    if(f.km){ await sb.from("km_historie").insert({motor_id:motor.id,km:parseInt(f.km),datum:TODAY}); }
    const nieuwMotor = {...motor,kmHistory:f.km?[{datum:TODAY,km:parseInt(f.km)}]:[],service:[]};
    setKlanten(p=>p.map(k=>k.id===klantId?{...k,motoren:[...k.motoren,nieuwMotor]}:k));
  };

  const addService = async (klantId, motorId, f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const {data:svc} = await sb.from("service_beurten").insert({
      motor_id:motorId, datum:f.datum, omschrijving:f.omschrijving, km:f.km||null,
      voorband_datum:f.voorband_datum||null, achterband_datum:f.achterband_datum||null,
    }).select().single();
    if(!svc) return;
    const kmVal = f.km ? parseInt(f.km) : 0;
    const updates = [sb.from("motoren").update({last_service_km:kmVal}).eq("id",motorId)];
    if(kmVal>0) updates.push(sb.from("km_historie").insert({motor_id:motorId, km:kmVal, datum:f.datum}));
    await Promise.all(updates);
    setKlanten(p=>p.map(k=>k.id===klantId?{...k,motoren:k.motoren.map(m=>m.id===motorId?{
      ...m,
      service:[svc,...m.service],
      last_service_km:kmVal,
      kmHistory: kmVal>0 ? [...(m.kmHistory||[]), {datum:f.datum, km:kmVal}] : m.kmHistory
    }:m)}:k));
  };

  const updateMotorInterval = async (motorId, intervalKm) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    await sb.from("motoren").update({ interval_km: intervalKm }).eq("id", motorId);
    setKlanten(p=>p.map(k=>({...k,motoren:k.motoren.map(m=>m.id===motorId?{...m,interval_km:intervalKm}:m)})));
  };

  const updateService = async (klantId, motorId, svcId, f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const kmVal = f.km ? parseInt(f.km) : null;
    await sb.from("service_beurten").update({
      datum:f.datum, omschrijving:f.omschrijving, km:kmVal,
      voorband_datum:f.voorband_datum||null, achterband_datum:f.achterband_datum||null,
    }).eq("id",svcId);
    if(kmVal) await sb.from("motoren").update({last_service_km:kmVal}).eq("id",motorId);
    setKlanten(p=>p.map(k=>k.id===klantId?{...k,motoren:k.motoren.map(m=>m.id===motorId?{
      ...m,
      service:m.service.map(sv=>sv.id===svcId?{...sv,datum:f.datum,omschrijving:f.omschrijving,km:kmVal,voorband_datum:f.voorband_datum||null,achterband_datum:f.achterband_datum||null}:sv),
      last_service_km:kmVal||m.last_service_km
    }:m)}:k));
  };

  const deleteService = async (klantId, motorId, svcId) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    await sb.from("service_beurten").delete().eq("id",svcId);
    setKlanten(p=>p.map(k=>k.id===klantId?{...k,motoren:k.motoren.map(m=>m.id===motorId?{...m,service:m.service.filter(sv=>sv.id!==svcId)}:m)}:k));
  };

  const deleteKlant = async (klant) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const motorIds = (klant.motoren||[]).map(m=>m.id);
    // Verwijder in volgorde: service → km → motoren → afspraken → klant
    if(motorIds.length>0){
      await Promise.all([
        sb.from("service_beurten").delete().in("motor_id",motorIds),
        sb.from("km_historie").delete().in("motor_id",motorIds),
      ]);
      await sb.from("motoren").delete().in("id",motorIds);
    }
    await sb.from("afspraken").delete().eq("klant_id",klant.id);
    await sb.from("klanten").delete().eq("id",klant.id);
    setKlanten(p=>p.filter(k=>k.id!==klant.id));
    setAfspraken(p=>p.filter(a=>a.klant_id!==klant.id));
  };

  const verwijderCloudinaryFotos = async (fotos) => {
    const urls = (fotos||[]).filter(Boolean);
    if(!urls.length) return;
    const sb = (await import("../lib/supabase.js")).supabase;
    sb.functions.invoke("cloudinary-delete", { body: { urls } });
  };

  const addVoorraadMotor = async (f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const {data:v} = await sb.from("voorraad").insert({
      kenteken:f.kenteken, merk:f.merk, model:f.model||"",
      bouwjaar:parseInt(f.bouwjaar)||0, km:parseInt(f.km)||0,
      prijs:parseInt(f.prijs)||0, datum_in:f.datum_in||TODAY,
      fotos:f.fotos||[], voorband_datum:f.voorband_datum||null, achterband_datum:f.achterband_datum||null,
      chassis_nummer:f.chassis_nummer||null,
    }).select().single();
    if(v) setShowroom(p=>[v,...p]);
  };

  const updateVoorraadMotor = async (id, f, behoudeFotos, nieuweUrls, verwijderdeUrls) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const alleFotos = [...behoudeFotos, ...nieuweUrls];
    await sb.from("voorraad").update({
      merk:f.merk, model:f.model||"", bouwjaar:parseInt(f.bouwjaar)||0,
      km:parseInt(f.km)||0, prijs:parseInt(f.prijs)||0, datum_in:f.datum_in,
      chassis_nummer:f.chassis_nummer||null,
      voorband_datum:f.voorband_datum||null, achterband_datum:f.achterband_datum||null,
      fotos:alleFotos,
    }).eq("id",id);
    setShowroom(p=>p.map(m=>m.id===id?{
      ...m, merk:f.merk, model:f.model||"", bouwjaar:parseInt(f.bouwjaar)||0,
      km:parseInt(f.km)||0, prijs:parseInt(f.prijs)||0, datum_in:f.datum_in,
      chassis_nummer:f.chassis_nummer||null,
      voorband_datum:f.voorband_datum||null, achterband_datum:f.achterband_datum||null,
      fotos:alleFotos,
    }:m));
    if(verwijderdeUrls.length>0) verwijderCloudinaryFotos(verwijderdeUrls);
  };

  const verkoop = async (motor, klantId) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const k = klanten.find(k=>k.id===klantId);
    if(!k) return;
    const bewarenTot = new Date(TODAY); bewarenTot.setDate(bewarenTot.getDate()+30);
    const bewarenStr = bewarenTot.toISOString().split("T")[0];
    await sb.from("voorraad").update({
      verkocht_op:TODAY, verkocht_aan:klantId, status:"verkocht",
      fotos_bewaren_tot:(motor.fotos||[]).length>0 ? bewarenStr : null,
    }).eq("id",motor.id);
    const {data:nieuwMotor} = await sb.from("motoren").insert({
      klant_id:klantId,kenteken:motor.kenteken,merk:motor.merk,
      model:motor.model||"",bouwjaar:motor.bouwjaar||0,aankoopdatum:TODAY,
    }).select().single();
    if(nieuwMotor){
      setKlanten(p=>p.map(k=>k.id===klantId?{...k,motoren:[...k.motoren,{...nieuwMotor,kmHistory:[],service:[]}]}:k));
    }
    setShowroom(p=>p.filter(m=>m.id!==motor.id));
    // Foto's worden na 30 dagen verwijderd via fotos_bewaren_tot — NIET direct
  };

  const deleteVoorraadMotor = async (motor) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    await sb.from("voorraad").delete().eq("id",motor.id);
    setShowroom(p=>p.filter(m=>m.id!==motor.id));
    verwijderCloudinaryFotos(motor.fotos);
  };

  const toggleVoorraadStatus = async (motorId, nieuweStatus) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    await sb.from("voorraad").update({status:nieuweStatus}).eq("id",motorId);
    setShowroom(p=>p.map(m=>m.id===motorId?{...m,status:nieuweStatus}:m));
  };

  const addAfspraak = async (f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const klant = klanten.find(k=>k.naam===f.klant);
    const {data:afs} = await sb.from("afspraken").insert({
      klant_id:klant?.id||null, datum:f.datum, tijd:f.tijd,
      duur:parseInt(f.duur)||1, opmerking:f.omschrijving||"", status:"gepland",
      type:f.type||"service",
      naam:f.type==="proefrit"?(f.naam||f.klant||""):null,
      voorraad_motor_id:f.type==="proefrit"?(f.voorraad_motor_id||null):null,
    }).select().single();
    if(afs){
      const motor = f.type==="proefrit"&&f.voorraad_motor_id ? showroom.find(m=>m.id===f.voorraad_motor_id) : null;
      const motorLabel = motor ? `${motor.merk} ${motor.model}` : null;
      setAfspraken(p=>[...p,{...afs,klant:f.klant||f.naam||"",naam:afs.naam,omschrijving:f.omschrijving,motorLabel}]);
      if(f.type==="proefrit"&&f.voorraad_motor_id){
        await sb.from("voorraad").update({status:"gereserveerd"}).eq("id",f.voorraad_motor_id);
        setShowroom(p=>p.map(m=>m.id===f.voorraad_motor_id?{...m,status:"gereserveerd"}:m));
      }
    }
  };

  const editAfspraak = async (f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    // Als er een tijd is ingesteld, markeer als gepland (ook bij aanvragen)
    const nieuweStatus = f.tijd ? "gepland" : (f.status || "aangevraagd");
    await sb.from("afspraken").update({
      datum:f.datum, tijd:f.tijd||null, duur:parseInt(f.duur)||1,
      opmerking:f.omschrijving||f.opmerking||"", status:nieuweStatus
    }).eq("id",f.id);
    setAfspraken(p=>p.map(a=>a.id===f.id?{...a,...f,status:nieuweStatus}:a));
  };

  const deleteAfspraak = async (id) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const afs = afspraken.find(a=>a.id===id);
    await sb.from("afspraken").delete().eq("id",id);
    setAfspraken(p=>p.filter(a=>a.id!==id));
    if(afs?.type==="proefrit"&&afs?.voorraad_motor_id){
      const motor = showroom.find(m=>m.id===afs.voorraad_motor_id);
      if(motor?.status==="gereserveerd"){
        await sb.from("voorraad").update({status:"beschikbaar"}).eq("id",afs.voorraad_motor_id);
        setShowroom(p=>p.map(m=>m.id===afs.voorraad_motor_id?{...m,status:"beschikbaar"}:m));
      }
    }
  };

  const toggleGeslotenDag = async (datum, blokkeer) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const { data: inst } = await sb.from("instellingen").select("gesloten_dagen").single();
    const huidig = inst?.gesloten_dagen || [];
    const nieuw = blokkeer ? [...new Set([...huidig, datum])] : huidig.filter(d=>d!==datum);
    await sb.from("instellingen").update({ gesloten_dagen: nieuw }).eq("id", 1);
    setGeslotenDagen(nieuw);
  };

  const [geslotenDagen, setGeslotenDagen] = useState([]);
  const [openingstijden, setOpeningstijden] = useState(null);
  const [opmerking, setOpmerking] = useState("");

  const slaOpeningstijdenOp = async (tijden) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    await sb.from("instellingen").update({ openingstijden: tijden }).eq("id", 1);
    setOpeningstijden(tijden);
  };

  const slaOpmerkingOp = async (tekst) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    await sb.from("instellingen").update({ opmerking: tekst }).eq("id", 1);
    setOpmerking(tekst);
  };

  // Realtime: nieuwe/gewijzigde/verwijderde afspraken van klanten
  useEffect(() => {
    let sub;
    import("../lib/supabase.js").then(({ supabase: sb }) => {
      sub = sb.channel("admin-afspraken")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "afspraken" }, ({ new: n }) => {
          sb.from("afspraken").select("*, klanten(naam), motoren(merk, model, kenteken)").eq("id", n.id).single()
            .then(({ data }) => {
              if(data) setAfspraken(p => [...p, { ...data, klant: data.klanten?.naam || "Onbekend", motorLabel: data.motoren?[data.motoren.merk,data.motoren.model].filter(Boolean).join(" ")||null:null }]);
            });
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "afspraken" }, ({ new: n }) => {
          sb.from("afspraken").select("*, klanten(naam), motoren(merk, model, kenteken)").eq("id", n.id).single()
            .then(({ data }) => {
              if(data) setAfspraken(p => p.map(a => a.id === data.id ? { ...data, klant: data.klanten?.naam || "Onbekend", motorLabel: data.motoren?[data.motoren.merk,data.motoren.model].filter(Boolean).join(" ")||null:null } : a));
            });
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "afspraken" }, ({ old: o }) => {
          setAfspraken(p => p.filter(a => a.id !== o.id));
        })
        .subscribe();
    });
    return () => { if(sub) sub.unsubscribe(); };
  }, []);

  const nav=[
    {id:"dashboard",icon:"◈",label:"Dashboard"},
    {id:"klanten",icon:"◎",label:"Klanten"},
    {id:"voorraad",icon:"◧",label:"Voorraad"},
    {id:"agenda",icon:"◫",label:"Agenda"},
    {id:"instellingen",icon:"◉",label:"Instellingen"},
  ];

  if(laden) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100dvh",background:T.bg,color:T.accent,fontFamily:"Barlow, sans-serif",fontSize:14,gap:10}}>
      <div style={{width:16,height:16,border:`2px solid ${T.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      Laden...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const pageContent = (
    <>
      {page==="dashboard"&&<Dashboard klanten={klanten} showroom={showroom} afspraken={afspraken} onNav={setPage}/>}
      {page==="klanten"&&<KlantenPage klanten={klanten} onAddKlant={addKlant} onUpdateKlant={updateKlant} onAddMotor={addMotorAanKlant} onAddService={addService} onUpdateService={updateService} onDeleteService={deleteService} onDeleteKlant={deleteKlant} onUpdateMotorInterval={updateMotorInterval} voorraad={showroom}/>}
      {page==="voorraad"&&<VoorraadPage showroom={showroom} onAddMotor={addVoorraadMotor} onEditMotor={updateVoorraadMotor} klanten={klanten} onVerkoop={verkoop} onDelete={deleteVoorraadMotor} onToggleStatus={toggleVoorraadStatus} afspraken={afspraken} onAddAfspraak={addAfspraak}/>}
      {page==="agenda"&&<AgendaPage afspraken={afspraken} klanten={klanten} voorraad={showroom} onAddAfspraak={addAfspraak} onEditAfspraak={editAfspraak} onDeleteAfspraak={deleteAfspraak} geslotenDagen={geslotenDagen} onToggleGesloten={toggleGeslotenDag} openingstijden={openingstijden}/>}
      {page==="instellingen"&&<InstellingenPage openingstijden={openingstijden} geslotenDagen={geslotenDagen} onSaveTijden={slaOpeningstijdenOp} onToggleGesloten={toggleGeslotenDag} opmerking={opmerking} onSaveOpmerking={slaOpmerkingOp}/>}
    </>
  );

  if(isMobile){
    return(
      <div style={{display:"flex",flexDirection:"column",height:"100dvh",background:T.bg,fontFamily:"Barlow, sans-serif",color:T.text}}>
        {/* Mobile header */}
        <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,background:T.surf}}>
          <div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:900,fontSize:16,letterSpacing:2,color:T.text}}>DE JONGE</div>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:600,fontSize:10,letterSpacing:4,color:T.accent}}>MOTOREN</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:11,color:T.muted}}>{new Date().toLocaleDateString("nl-NL",{day:"numeric",month:"short"})}</div>
            <button onClick={()=>import("../lib/supabase.js").then(m=>m.uitloggen())} style={{padding:"5px 10px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:4,color:T.muted,fontSize:11,cursor:"pointer",fontFamily:"Barlow, sans-serif"}}>Uit</button>
          </div>
        </div>
        {/* Page title */}
        <div style={{padding:"10px 14px 2px",flexShrink:0}}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:20,letterSpacing:1}}>{nav.find(n=>n.id===page)?.label.toUpperCase()}</div>
        </div>
        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"8px 14px 14px"}}>
          {pageContent}
        </div>
        {/* Bottom nav */}
        <div style={{display:"flex",borderTop:`1px solid ${T.border}`,background:T.surf,flexShrink:0,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {nav.map(n=>(
            <button key={n.id} onClick={()=>setPage(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 4px 10px",background:"none",border:"none",borderTop:`2px solid ${page===n.id?T.accent:"transparent"}`,color:page===n.id?T.accent:T.muted,cursor:"pointer",fontFamily:"Barlow, sans-serif",fontSize:9,fontWeight:page===n.id?600:400}}>
              <span style={{fontSize:15}}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return(
    <div style={s.app}>
      <div style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoTop}>DE JONGE</div>
          <div style={s.logoSub}>MOTOREN</div>
        </div>
        <nav style={{padding:"10px 0",flex:1}}>
          {nav.map(n=>(
            <div key={n.id} style={s.navItem(page===n.id)} onClick={()=>setPage(n.id)}>
              <span style={{fontSize:13,width:16,textAlign:"center"}}>{n.icon}</span>
              <span>{n.label}</span>
            </div>
          ))}
        </nav>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,fontSize:11,color:T.muted,lineHeight:1.6}}>
          Admin<br/>De Jonge Motoren
        </div>
      </div>
      <div style={s.main}>
        <div style={s.header}>
          <div style={s.headerTitle}>{nav.find(n=>n.id===page)?.label.toUpperCase()}</div>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <div style={{fontSize:12,color:T.muted}}>{new Date().toLocaleDateString("nl-NL",{weekday:"short",day:"numeric",month:"long",year:"numeric"})}</div>
            <button onClick={()=>import("../lib/supabase.js").then(m=>m.uitloggen())} style={{padding:"5px 12px",background:"transparent",border:`1px solid ${T.border}`,borderRadius:4,color:T.muted,fontSize:11,cursor:"pointer",fontFamily:"Barlow, sans-serif"}}>Uitloggen</button>
          </div>
        </div>
        <div style={s.content}>
          {pageContent}
        </div>
      </div>
    </div>
  );
}
