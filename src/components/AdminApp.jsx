import { useState, useEffect } from "react";

function useFonts() {
  useEffect(() => {
    const el = document.createElement("link");
    el.rel = "stylesheet";
    el.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600&display=swap";
    document.head.appendChild(el);
  }, []);
}

const T = {
  bg: "#080808", surf: "#111111", surf2: "#1A1A1A", border: "#252525",
  accent: "#E8520A", text: "#EEEBE6", muted: "#666660",
  green: "#22C55E", yellow: "#F59E0B", red: "#EF4444",
};

const s = {
  app: { display:"flex", height:"100vh", background:T.bg, fontFamily:"Barlow, sans-serif", color:T.text, overflow:"hidden" },
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
const TODAY = new Date().toISOString().split("T")[0];
const DAYS_NL = ["Ma","Di","Wo","Do","Vr","Za"];
const fmtDate = d => { const [,mm,dd]=d.split("-"); return `${dd}/${mm}`; };

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

// ── Mock Data ────────────────────────────────────────────────────────────────
const INIT_KLANTEN = [
  { id:1, naam:"Pieter de Vries", email:"pieter@mail.nl", telefoon:"06-12345678", adres:"Hoofdstraat 12", postcode:"4691AA", woonplaats:"Tholen",
    motoren:[
      { id:1, kenteken:"TH-123-B", merk:"Honda", model:"CB500F", bouwjaar:2019, km:18500, aankoopdatum:"2024-03-15", service:[
        {id:1,datum:"2024-06-10",omschrijving:"Olie vervangen, luchtfilter gereinigd"},
        {id:2,datum:"2025-01-15",omschrijving:"APK + ketting gespannen"},
      ]},
      { id:2, kenteken:"TH-456-C", merk:"Yamaha", model:"MT-07", bouwjaar:2021, km:8200, aankoopdatum:"2025-02-20", service:[] },
    ]},
  { id:2, naam:"Karin Visser", email:"karin@gmail.com", telefoon:"06-87654321", adres:"Molenweg 5", postcode:"4611BZ", woonplaats:"Bergen op Zoom",
    motoren:[
      { id:3, kenteken:"BZ-789-D", merk:"Kawasaki", model:"Z650", bouwjaar:2022, km:5100, aankoopdatum:"2025-01-08", service:[] },
    ]},
  { id:3, naam:"Bas Mooij", email:"bas@hotmail.com", telefoon:"06-55511222", adres:"Zeestraat 33", postcode:"4301KA", woonplaats:"Zierikzee",
    motoren:[
      { id:4, kenteken:"ZZ-001-E", merk:"BMW", model:"R1250GS", bouwjaar:2020, km:32000, aankoopdatum:"2024-11-22", service:[
        {id:3,datum:"2025-03-01",omschrijving:"Grote beurt: remmen, vloeistoffen, banden check"},
      ]},
    ]},
];

const INIT_SHOWROOM = [
  {id:101,kenteken:"GO-234-F",merk:"Triumph",model:"Street Triple",bouwjaar:2021,km:12000,prijs:8950,datum_in:"2025-05-01"},
  {id:102,kenteken:"ZL-567-G",merk:"Ducati",model:"Monster 797",bouwjaar:2019,km:21000,prijs:7500,datum_in:"2025-04-15"},
  {id:103,kenteken:"NB-890-H",merk:"Honda",model:"CBR650R",bouwjaar:2023,km:3200,prijs:11500,datum_in:"2025-05-20"},
];

const addDays = (n) => { const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().split("T")[0]; };
const INIT_AFSPRAKEN = [
  {id:1,klant:"Pieter de Vries",datum:TODAY,tijd:"09:00",duur:2,omschrijving:"Olie vervangen Honda CB500F",motor:"TH-123-B"},
  {id:2,klant:"Karin Visser",datum:TODAY,tijd:"13:00",duur:4,omschrijving:"Grote beurt Kawasaki Z650",motor:"BZ-789-D"},
  {id:3,klant:"Bas Mooij",datum:addDays(1),tijd:"10:00",duur:1,omschrijving:"Bandencheck BMW GS",motor:"ZZ-001-E"},
  {id:4,klant:"Nieuw klant",datum:addDays(2),tijd:"14:00",duur:3,omschrijving:"APK + check",motor:"-"},
];

// ── Shared UI ────────────────────────────────────────────────────────────────
function Modal({title,onClose,children}){
  return(
    <div style={s.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={s.modal}>
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

function Grid2({children}){ return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{children}</div>; }

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

function ServiceModal({onSave,onClose}){
  const [f,setF]=useState({datum:TODAY,omschrijving:""});
  return(
    <Modal title="SERVICE TOEVOEGEN" onClose={onClose}>
      <Field label="Datum"><input style={s.input} type="date" value={f.datum} onChange={e=>setF(p=>({...p,datum:e.target.value}))}/></Field>
      <Field label="Omschrijving">
        <textarea style={{...s.input,height:90,resize:"vertical"}} value={f.omschrijving} onChange={e=>setF(p=>({...p,omschrijving:e.target.value}))} placeholder="Wat is er gedaan?"/>
      </Field>
      <ModalFooter onClose={onClose} onClick={()=>{if(f.omschrijving){onSave(f);onClose();}}}/>
    </Modal>
  );
}

function VoorraadModal({onSave,onClose}){
  const [kenteken,setKenteken]=useState("");
  const [f,setF]=useState({merk:"",model:"",bouwjaar:"",km:"",prijs:"",datum_in:TODAY});
  const [status,setStatus]=useState(null); // null | "laden" | "gevonden" | "niet_gevonden" | "fout"
  const set=k=>e=>setF(p=>({...p,[k]:e.target.value}));

  const normKenteken = k => k.replace(/-/g,"").toUpperCase();

  const haalRDWOp = async () => {
    const ken = normKenteken(kenteken);
    if(!ken) return;
    setStatus("laden");
    try {
      const res = await fetch(`https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${ken}`);
      const data = await res.json();
      if(!data||data.length===0){ setStatus("niet_gevonden"); return; }
      const v = data[0];
      setF(p=>({
        ...p,
        merk: v.merk ? v.merk.charAt(0)+v.merk.slice(1).toLowerCase() : "",
        model: v.handelsbenaming || "",
        bouwjaar: v.datum_eerste_toelating ? v.datum_eerste_toelating.substring(0,4) : "",
      }));
      setStatus("gevonden");
    } catch(e){ setStatus("fout"); }
  };

  const kentekenGeformateerd = normKenteken(kenteken);
  const rdwGegevensGeladen = status==="gevonden";

  return(
    <Modal title="MOTOR TOEVOEGEN — VOORRAAD" onClose={onClose}>
      {/* Stap 1: kenteken */}
      <div style={s.sectionLabel}>Stap 1 — Kenteken opzoeken via RDW</div>
      <div style={{display:"flex",gap:8,marginBottom:6}}>
        <input style={{...s.input,flex:1,fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:16,letterSpacing:2,textTransform:"uppercase"}}
          value={kenteken} onChange={e=>setKenteken(e.target.value)}
          placeholder="AB-123-C" onKeyDown={e=>e.key==="Enter"&&haalRDWOp()}/>
        <button style={{...s.btn,flexShrink:0}} onClick={haalRDWOp} disabled={status==="laden"}>
          {status==="laden"?"Laden...":"Ophalen →"}
        </button>
      </div>
      {status==="niet_gevonden"&&<div style={{fontSize:12,color:T.red,marginBottom:10}}>⚠ Kenteken niet gevonden in RDW — vul gegevens handmatig in.</div>}
      {status==="fout"&&<div style={{fontSize:12,color:T.red,marginBottom:10}}>⚠ Verbinding mislukt — vul gegevens handmatig in.</div>}
      {status==="gevonden"&&<div style={{fontSize:12,color:T.green,marginBottom:10}}>✓ Gegevens opgehaald uit RDW — controleer en pas aan indien nodig.</div>}

      {/* Stap 2: details (altijd zichtbaar, invulbaar) */}
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
      <ModalFooter onClose={onClose} label="Toevoegen aan voorraad"
        onClick={()=>{if(kentekenGeformateerd&&f.merk){onSave({...f,kenteken:kentekenGeformateerd});onClose();}}}/>
    </Modal>
  );
}

function AfspraakModal({afspraken,klanten,onSave,onClose}){
  const [f,setF]=useState({klant:"",motor:"",datum:TODAY,duur:"1",omschrijving:"",tijd:""});
  const set=k=>e=>{
    const val=e.target.value;
    setF(p=>({...p,[k]:val,...(k==="datum"||k==="duur"?{tijd:""}:{})}));
  };
  const selectedKlant=klanten.find(k=>k.naam===f.klant);
  const slots=f.datum&&f.duur?getSlots(afspraken,f.datum,parseInt(f.duur)):[];

  return(
    <Modal title="AFSPRAAK INPLANNEN" onClose={onClose}>
      <Field label="Klant">
        <select style={s.input} value={f.klant} onChange={e=>setF(p=>({...p,klant:e.target.value,motor:""}))}>
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
          <select style={s.input} value={f.duur} onChange={set("duur")}>
            {[1,2,3,4,5,6,7,8].map(h=><option key={h}>{h}</option>)}
          </select>
        </Field>
      </Grid2>
      {f.datum&&(
        <Field label={`Beschikbare tijden — ${fmtDate(f.datum)} — ${f.duur}u blok`}>
          {slots.length===0?(
            <div style={{padding:"10px 12px",background:T.surf2,borderRadius:4,color:T.red,fontSize:13}}>
              ⚠ Geen vrij blok van {f.duur} uur beschikbaar op deze dag
            </div>
          ):(
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {slots.map(t=>(
                <button key={t} onClick={()=>setF(p=>({...p,tijd:t}))}
                  style={{padding:"7px 13px",borderRadius:4,border:`1px solid ${f.tijd===t?T.accent:T.border}`,background:f.tijd===t?`${T.accent}25`:"transparent",color:f.tijd===t?T.accent:T.muted,cursor:"pointer",fontSize:13,fontFamily:"Barlow, sans-serif"}}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </Field>
      )}
      <Field label="Omschrijving">
        <textarea style={{...s.input,height:75,resize:"vertical"}} value={f.omschrijving} onChange={e=>setF(p=>({...p,omschrijving:e.target.value}))} placeholder="Wat moet er gedaan worden?"/>
      </Field>
      <ModalFooter onClose={onClose} label="Inplannen"
        onClick={()=>{if(f.klant&&f.tijd){onSave({...f,duur:parseInt(f.duur)});onClose();}}}/>
    </Modal>
  );
}

// ── Pages ────────────────────────────────────────────────────────────────────
function Dashboard({klanten,showroom,afspraken,onNav}){
  const totalMotoren=klanten.reduce((a,k)=>a+(k.motoren||[]).length,0);
  const vandaag=afspraken.filter(a=>a.datum===TODAY);
  const komend=afspraken.filter(a=>a.datum>=TODAY).sort((a,b)=>a.datum.localeCompare(b.datum)||(a.tijd||"").localeCompare(b.tijd||"")).slice(0,6);

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
        {[{num:klanten.length,lbl:"Klanten"},{num:totalMotoren,lbl:"Motoren"},{num:showroom.length,lbl:"Voorraad"},{num:vandaag.length,lbl:"Afspraken vandaag"}].map((x,i)=>(
          <div key={i} style={s.statCard}>
            <div style={s.statNum}>{x.num}</div>
            <div style={s.statLabel}>{x.lbl}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div style={s.card}>
          <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:1,marginBottom:14,textTransform:"uppercase",color:T.text}}>
            Vandaag · {fmtDate(TODAY)}
          </div>
          {vandaag.length===0?<div style={{color:T.muted,fontSize:13}}>Geen afspraken vandaag</div>:vandaag.map(a=>(
            <div key={a.id} style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`,display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{background:T.accent,color:"#fff",padding:"3px 8px",borderRadius:3,fontSize:12,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{a.tijd}</div>
              <div>
                <div style={{fontSize:14,fontWeight:500}}>{a.klant}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:2}}>{a.omschrijving} · {a.duur}u</div>
              </div>
            </div>
          ))}
        </div>
        <div style={s.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:15,letterSpacing:1,textTransform:"uppercase"}}>Komende Afspraken</div>
            <button style={s.btn} onClick={()=>onNav("agenda")}>+ Nieuw</button>
          </div>
          {komend.map(a=>(
            <div key={a.id} style={{padding:"10px 0",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:500}}>{a.klant}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:2}}>{a.omschrijving}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                <div style={{fontSize:12,color:T.accent}}>{fmtDate(a.datum)}</div>
                <div style={{fontSize:12,color:T.muted}}>{a.tijd} · {a.duur}u</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KlantenPage({klanten,onAddKlant,onUpdateKlant,onAddMotor,onAddService,voorraad=[]}){
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("alle"); // "alle" | "geen_account"
  const [sel,setSel]=useState(null);
  const [modal,setModal]=useState(null);
  const [selMotorId,setSelMotorId]=useState(null);
  const [uitnodigKlant,setUitnodigKlant]=useState(null);

  const geenAccount = klanten.filter(k=>!k.user_id);

  const filtered=klanten.filter(k=>{
    const matchSearch = k.naam.toLowerCase().includes(search.toLowerCase())||
      (k.motoren||[]).some(m=>(m.kenteken||"").toLowerCase().includes(search.toLowerCase()));
    const matchFilter = filter==="alle" || (filter==="geen_account" && !k.user_id);
    return matchSearch && matchFilter;
  });
  const klant=sel?klanten.find(k=>k.id===sel):null;
  const klantMotoren = klant?.motoren || [];

  const addMotor=f=>{ if(klant) onAddMotor(klant.id,f); };
  const addService=f=>{ if(klant&&selMotorId) onAddService(klant.id,selMotorId,f); };

  return(
    <div style={{display:"flex",gap:18,height:"100%"}}>
      <div style={{width:300,flexShrink:0,display:"flex",flexDirection:"column",gap:8}}>
        <div style={{display:"flex",gap:8}}>
          <input style={{...s.input,flex:1}} placeholder="Zoek naam of kenteken..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <button style={s.btn} onClick={()=>setModal("addKlant")}>+</button>
        </div>
        <div style={{display:"flex",gap:6}}>
          {[["alle","Alle"],["geen_account",`Geen account${geenAccount.length>0?` (${geenAccount.length})`:""}`]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setFilter(id)}
              style={{flex:1,padding:"7px 8px",borderRadius:4,border:`1px solid ${filter===id?T.accent:T.border}`,background:filter===id?`${T.accent}20`:"transparent",color:filter===id?T.accent:T.muted,cursor:"pointer",fontSize:12,fontFamily:"Barlow, sans-serif"}}>
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

      <div style={{flex:1,overflowY:"auto"}}>
        {!klant?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200,color:T.muted,fontSize:13}}>← Selecteer een klant</div>
        ):(
          <div>
            <div style={{...s.card,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:22}}>{klant.naam}</div>
                  <div style={{fontSize:13,color:T.muted,marginTop:6,lineHeight:1.8}}>
                    {klant.email} · {klant.telefoon}<br/>
                    {klant.adres}, {klant.postcode} {klant.woonplaats}
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={s.btnOutline} onClick={()=>setUitnodigKlant(klant)}>Uitnodigen</button>
                  <button style={s.btn} onClick={()=>setModal("addMotor")}>+ Motor</button>
                </div>
              </div>
            </div>
            {klantMotoren.map(motor=>(
              <div key={motor.id} style={{...s.card,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:17}}>
                      {motor.merk} {motor.model}
                      <span style={{...s.badge(T.accent),marginLeft:10,fontSize:10}}>{motor.kenteken}</span>
                    </div>
                    <div style={{fontSize:12,color:T.muted,marginTop:4}}>
                      {motor.bouwjaar} · {motor.kmHistory?.length ? motor.kmHistory[motor.kmHistory.length-1].km.toLocaleString() : "—"} km · {motor.aankoopdatum ? `Gekocht ${motor.aankoopdatum}` : "Eigen motor"}
                    </div>
                  </div>
                  <button style={s.btn} onClick={()=>{setSelMotorId(motor.id);setModal("addService");}}>+ Service</button>
                </div>
                {(motor.service||[]).length===0?(
                  <div style={{fontSize:12,color:T.muted,padding:"6px 0"}}>Nog geen servicemeldingen</div>
                ):(
                  (motor.service||[]).slice().reverse().map(sv=>(
                    <div key={sv.id} style={{display:"flex",gap:14,padding:"8px 0",borderTop:`1px solid ${T.border}`}}>
                      <div style={{fontSize:12,color:T.accent,whiteSpace:"nowrap",paddingTop:1,minWidth:80}}>{sv.datum}</div>
                      <div style={{fontSize:13}}>{sv.omschrijving}</div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {modal==="addKlant"&&<KlantModal onSave={onAddKlant} onClose={()=>setModal(null)} voorraad={voorraad}/>}
      {modal==="addMotor"&&<MotorModal onSave={addMotor} onClose={()=>setModal(null)}/>}
      {modal==="addService"&&<ServiceModal onSave={addService} onClose={()=>setModal(null)}/>}
      {uitnodigKlant&&<UitnodigingModal klant={uitnodigKlant} onClose={()=>setUitnodigKlant(null)}/>}
    </div>
  );
}

function VoorraadPage({showroom,onAddMotor,klanten,onVerkoop}){
  const [modal,setModal]=useState(null);
  const [verkoopMotor,setVerkoopMotor]=useState(null);
  const [verkoopKlant,setVerkoopKlant]=useState("");

  return(
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
        <button style={s.btn} onClick={()=>setModal("add")}>+ Motor Toevoegen</button>
      </div>
      {showroom.length===0&&<div style={{color:T.muted,fontSize:13,textAlign:"center",marginTop:60}}>Geen motors in voorraad</div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
        {showroom.map(m=>(
          <div key={m.id} style={s.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:700,fontSize:18}}>{m.merk} {m.model}</div>
                <span style={{...s.badge(T.muted),marginTop:4,display:"inline-block"}}>{m.kenteken}</span>
              </div>
              <div style={{fontFamily:"Barlow Condensed, sans-serif",fontWeight:800,fontSize:20,color:T.accent}}>€{m.prijs.toLocaleString()}</div>
            </div>
            <div style={{fontSize:12,color:T.muted,lineHeight:1.8,marginBottom:12}}>
              {m.bouwjaar} · {m.km.toLocaleString()} km · Binnen: {m.datum_in}
            </div>
            <button onClick={()=>{setVerkoopMotor(m);setVerkoopKlant("");}} style={s.btnOutline}>
              Verkopen aan klant →
            </button>
          </div>
        ))}
      </div>

      {modal==="add"&&<VoorraadModal onSave={onAddMotor} onClose={()=>setModal(null)}/>}

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
    </div>
  );
}

function AgendaPage({afspraken,klanten,onAddAfspraak,geslotenDagen=[],onToggleGesloten}){
  const [weekBase,setWeekBase]=useState(TODAY);
  const [modal,setModal]=useState(false);
  const [blokkeerDatum,setBlokkeerDatum]=useState(null);
  const weekDates=getWeekDates(weekBase);
  const prev=()=>{const d=new Date(weekDates[0]);d.setDate(d.getDate()-7);setWeekBase(d.toISOString().split("T")[0]);};
  const next=()=>{const d=new Date(weekDates[0]);d.setDate(d.getDate()+7);setWeekBase(d.toISOString().split("T")[0]);};
  const HOURS=Array.from({length:9},(_,i)=>i+9); // 09-17
  const CAL_H=440;
  const TOTAL_MIN=WEND-WSTART;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button style={s.btnGhost} onClick={prev}>← Vorige</button>
          <span style={{fontSize:13,color:T.muted,minWidth:120,textAlign:"center"}}>{fmtDate(weekDates[0])} – {fmtDate(weekDates[5])}</span>
          <button style={s.btnGhost} onClick={next}>Volgende →</button>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button style={s.btnGhost} onClick={()=>setBlokkeerDatum(TODAY)}>🔒 Dag blokkeren</button>
          <button style={s.btn} onClick={()=>setModal(true)}>+ Afspraak</button>
        </div>
      </div>

      <div style={{...s.card,padding:0,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"44px repeat(6,1fr)",borderBottom:`1px solid ${T.border}`}}>
          <div/>
          {weekDates.map((d,i)=>{
            const isGesloten=geslotenDagen.includes(d);
            return(
              <div key={d} style={{padding:"10px 6px",textAlign:"center",borderLeft:`1px solid ${T.border}`,background:isGesloten?`${T.red}10`:d===TODAY?`${T.accent}18`:"transparent"}}>
                <div style={{fontSize:10,color:T.muted,letterSpacing:1}}>{DAYS_NL[i]}</div>
                <div style={{fontSize:14,fontWeight:d===TODAY?700:400,color:isGesloten?T.red:d===TODAY?T.accent:T.text,marginTop:2}}>{fmtDate(d)}</div>
                {isGesloten&&<div style={{fontSize:9,color:T.red,marginTop:2,letterSpacing:0.5}}>GESLOTEN</div>}
              </div>
            );
          })}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"44px repeat(6,1fr)",position:"relative",height:CAL_H}}>
          <div style={{position:"relative",borderRight:`1px solid ${T.border}`}}>
            {HOURS.map(h=>(
              <div key={h} style={{position:"absolute",top:`${(h-9)/8*100}%`,right:6,fontSize:10,color:T.muted,transform:"translateY(-50%)"}}>
                {h}:00
              </div>
            ))}
          </div>

          {weekDates.map((d)=>{
            const apts=afspraken.filter(a=>a.datum===d);
            const isGesloten=geslotenDagen.includes(d);
            return(
              <div key={d} style={{borderLeft:`1px solid ${T.border}`,position:"relative",background:isGesloten?`${T.red}08`:d===TODAY?`${T.accent}06`:"transparent"}}>
                {HOURS.map(h=>(
                  <div key={h} style={{position:"absolute",top:`${(h-9)/8*100}%`,left:0,right:0,borderTop:`1px solid ${T.border}22`}}/>
                ))}
                {isGesloten&&(
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{fontSize:11,color:T.red,fontWeight:600,letterSpacing:1}}>GESLOTEN</div>
                  </div>
                )}
                {!isGesloten&&apts.map(a=>{
                  const startMin=timeToMin(a.tijd||"09:00")-WSTART;
                  const top=Math.max(0,startMin/TOTAL_MIN*100);
                  const height=Math.min((a.duur||1)*60/TOTAL_MIN*100,100-top);
                  return(
                    <div key={a.id} style={{position:"absolute",top:`${top}%`,height:`${height}%`,left:3,right:3,background:`${T.accent}28`,border:`1px solid ${T.accent}80`,borderRadius:4,padding:"4px 6px",overflow:"hidden",cursor:"default"}}>
                      <div style={{fontSize:11,fontWeight:700,color:T.accent}}>{a.tijd}</div>
                      <div style={{fontSize:10,color:T.text,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.klant}</div>
                      {height>6&&<div style={{fontSize:10,color:T.muted}}>{a.duur}u</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {modal&&<AfspraakModal afspraken={afspraken} klanten={klanten} onSave={a=>{onAddAfspraak(a);setModal(false);}} onClose={()=>setModal(false)}/>}

      {blokkeerDatum!==null&&(
        <Modal title="DAG BLOKKEREN" onClose={()=>setBlokkeerDatum(null)}>
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Selecteer een datum om te blokkeren voor afspraken. Klanten kunnen die dag niet boeken.</div>
          <Field label="Datum">
            <input style={s.input} type="date" value={blokkeerDatum} onChange={e=>setBlokkeerDatum(e.target.value)} min={TODAY}/>
          </Field>
          {geslotenDagen.includes(blokkeerDatum)&&(
            <div style={{fontSize:12,color:T.yellow,marginBottom:10}}>⚠ Deze dag staat al geblokkeerd — klik "Deblokkeren" om hem vrij te geven.</div>
          )}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20,paddingTop:16,borderTop:`1px solid ${T.border}`}}>
            <button style={s.btnGhost} onClick={()=>setBlokkeerDatum(null)}>Annuleer</button>
            {geslotenDagen.includes(blokkeerDatum)?(
              <button style={{...s.btn,background:T.green}} onClick={()=>{onToggleGesloten(blokkeerDatum,false);setBlokkeerDatum(null);}}>Deblokkeren</button>
            ):(
              <button style={{...s.btn,background:T.red}} onClick={()=>{onToggleGesloten(blokkeerDatum,true);setBlokkeerDatum(null);}}>Dag blokkeren</button>
            )}
          </div>
        </Modal>
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

function InstellingenPage({openingstijden,geslotenDagen,onSaveTijden,onToggleGesloten}){
  const [tijden,setTijden]=useState(openingstijden||DEFAULT_TIJDEN);
  const [opgeslagen,setOpgeslagen]=useState(false);
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

  // Gesorteerde gesloten periodes weergeven als ranges
  const geslotenGesorteeerd = [...geslotenDagen].sort();
  const periodes = [];
  if(geslotenGesorteeerd.length > 0) {
    let start = geslotenGesorteeerd[0], prev = geslotenGesorteeerd[0];
    for(let i=1; i<=geslotenGesorteeerd.length; i++) {
      const cur = geslotenGesorteeerd[i];
      const prevDate = new Date(prev);
      const curDate = cur ? new Date(cur) : null;
      const isAaneengesloten = curDate && (curDate - prevDate === 86400000);
      if(!isAaneengesloten) {
        periodes.push({van:start, tot:prev});
        start = cur; 
      }
      prev = cur;
    }
  }

  return(
    <div style={{maxWidth:600}}>
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
        {periodes.length===0 ? (
          <div style={{fontSize:13,color:T.muted,marginBottom:16}}>Nog geen periodes ingesteld.</div>
        ) : periodes.map((p,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.border}`}}>
            <div style={{fontSize:13}}>
              {p.van===p.tot ? p.van : `${p.van} t/m ${p.tot}`}
            </div>
            <button onClick={()=>{
              const cur = new Date(p.van);
              const end = new Date(p.tot);
              while(cur <= end) { onToggleGesloten(cur.toISOString().split("T")[0], false); cur.setDate(cur.getDate()+1); }
            }} style={{background:"none",border:`1px solid ${T.red}`,color:T.red,borderRadius:4,padding:"4px 10px",fontSize:12,cursor:"pointer",fontFamily:"Barlow, sans-serif"}}>
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
  const [page,setPage]=useState("dashboard");
  const [klanten,setKlanten]=useState([]);
  const [showroom,setShowroom]=useState([]);
  const [afspraken,setAfspraken]=useState([]);
  const [laden,setLaden]=useState(true);

  // ── Data ophalen bij laden ──────────────────────────────────
  useEffect(()=>{
    Promise.all([
      import("../lib/supabase.js").then(m=>m.supabase.from("klanten").select("*").order("naam")),
      import("../lib/supabase.js").then(m=>m.supabase.from("voorraad").select("*").is("verkocht_op",null).order("created_at",{ascending:false})),
      import("../lib/supabase.js").then(m=>m.supabase.from("afspraken").select("*, klanten(naam)").order("datum")),
    ]).then(([k,v,a])=>{
      // Motoren, km_historie en service_beurten per klant ophalen
      const klantIds = (k.data||[]).map(x=>x.id);
      if(klantIds.length===0){ setLaden(false); return; }
      import("../lib/supabase.js").then(m=>
        Promise.all([
          m.supabase.from("motoren").select("*").in("klant_id",klantIds),
          m.supabase.from("km_historie").select("*").order("datum"),
          m.supabase.from("service_beurten").select("*").order("datum",{ascending:false}),
        ])
      ).then(([mot,km,svc])=>{
        const motoren = mot.data||[];
        const kmHist = km.data||[];
        const svcBeurten = svc.data||[];
        const verrijkt = (k.data||[]).map(klant=>({
          ...klant,
          motoren: motoren.filter(m=>m.klant_id===klant.id).map(m=>({
            ...m,
            kmHistory: kmHist.filter(x=>x.motor_id===m.id).map(x=>({datum:x.datum,km:x.km})),
            service: svcBeurten.filter(x=>x.motor_id===m.id).map(x=>({id:x.id,datum:x.datum,omschrijving:x.omschrijving,km:x.km})),
          }))
        }));
        setKlanten(verrijkt);
        setShowroom(v.data||[]);
        setAfspraken((a.data||[]).map(x=>({...x,klant:x.klanten?.naam||"Onbekend"})));
        setLaden(false);
      });
    });
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
      naam:u.naam,email:u.email,telefoon:u.telefoon,
      adres:u.adres,postcode:u.postcode,woonplaats:u.woonplaats
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
      motor_id:motorId, datum:f.datum, omschrijving:f.omschrijving, km:f.km||null
    }).select().single();
    if(!svc) return;
    await sb.from("motoren").update({last_service_km:f.km||0}).eq("id",motorId);
    setKlanten(p=>p.map(k=>k.id===klantId?{...k,motoren:k.motoren.map(m=>m.id===motorId?{...m,service:[svc,...m.service],last_service_km:f.km||0}:m)}:k));
  };

  const addVoorraadMotor = async (f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const {data:v} = await sb.from("voorraad").insert({
      kenteken:f.kenteken, merk:f.merk, model:f.model||"",
      bouwjaar:parseInt(f.bouwjaar)||0, km:parseInt(f.km)||0,
      prijs:parseInt(f.prijs)||0, datum_in:f.datum_in||TODAY
    }).select().single();
    if(v) setShowroom(p=>[v,...p]);
  };

  const verkoop = async (motor, klantId) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const k = klanten.find(k=>k.id===klantId);
    if(!k) return;
    await sb.from("voorraad").update({verkocht_op:TODAY,verkocht_aan:klantId}).eq("id",motor.id);
    const {data:nieuwMotor} = await sb.from("motoren").insert({
      klant_id:klantId,kenteken:motor.kenteken,merk:motor.merk,
      model:motor.model||"",bouwjaar:motor.bouwjaar||0,aankoopdatum:TODAY,
    }).select().single();
    if(nieuwMotor){
      setKlanten(p=>p.map(k=>k.id===klantId?{...k,motoren:[...k.motoren,{...nieuwMotor,kmHistory:[],service:[]}]}:k));
    }
    setShowroom(p=>p.filter(m=>m.id!==motor.id));
  };

  const addAfspraak = async (f) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    const klant = klanten.find(k=>k.naam===f.klant);
    const {data:afs} = await sb.from("afspraken").insert({
      klant_id:klant?.id||null, datum:f.datum, tijd:f.tijd,
      duur:parseInt(f.duur)||1, opmerking:f.omschrijving||"", status:"gepland"
    }).select().single();
    if(afs) setAfspraken(p=>[...p,{...afs,klant:f.klant,omschrijving:f.omschrijving,motor:f.motor}]);
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

  const slaOpeningstijdenOp = async (tijden) => {
    const sb = (await import("../lib/supabase.js")).supabase;
    await sb.from("instellingen").update({ openingstijden: tijden }).eq("id", 1);
    setOpeningstijden(tijden);
  };

  // Instellingen laden bij start
  useEffect(()=>{
    import("../lib/supabase.js").then(m=>
      m.supabase.from("instellingen").select("gesloten_dagen,openingstijden").single()
    ).then(({data})=>{
      if(data?.gesloten_dagen) setGeslotenDagen(data.gesloten_dagen);
      if(data?.openingstijden) setOpeningstijden(data.openingstijden);
    });
  },[]);

  const nav=[
    {id:"dashboard",icon:"◈",label:"Dashboard"},
    {id:"klanten",icon:"◎",label:"Klanten"},
    {id:"voorraad",icon:"◧",label:"Voorraad"},
    {id:"agenda",icon:"◫",label:"Agenda"},
    {id:"instellingen",icon:"◉",label:"Instellingen"},
  ];

  if(laden) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:T.bg,color:T.accent,fontFamily:"Barlow, sans-serif",fontSize:14,gap:10}}>
      <div style={{width:16,height:16,border:`2px solid ${T.accent}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      Laden...
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

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
          {page==="dashboard"&&<Dashboard klanten={klanten} showroom={showroom} afspraken={afspraken} onNav={setPage}/>}
          {page==="klanten"&&<KlantenPage klanten={klanten} onAddKlant={addKlant} onUpdateKlant={updateKlant} onAddMotor={addMotorAanKlant} onAddService={addService} voorraad={showroom}/>}
          {page==="voorraad"&&<VoorraadPage showroom={showroom} onAddMotor={addVoorraadMotor} klanten={klanten} onVerkoop={verkoop}/>}
          {page==="agenda"&&<AgendaPage afspraken={afspraken} klanten={klanten} onAddAfspraak={addAfspraak} geslotenDagen={geslotenDagen} onToggleGesloten={toggleGeslotenDag}/>}
          {page==="instellingen"&&<InstellingenPage openingstijden={openingstijden} geslotenDagen={geslotenDagen} onSaveTijden={slaOpeningstijdenOp} onToggleGesloten={toggleGeslotenDag}/>}
        </div>
      </div>
    </div>
  );
}
