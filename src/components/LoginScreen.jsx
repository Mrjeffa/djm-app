import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

const T_LIGHT = { bg:'#F8F8F8', surf:'#FFFFFF', surf2:'#F2F2F2', border:'#E0E0E0', accent:'#E31E24', text:'#1A1A1A', muted:'#767676', red:'#DC2626' }
const T_DARK  = { bg:'#111111', surf:'#1C1C1E', surf2:'#2C2C2E', border:'#38383A', accent:'#E31E24', text:'#F2F2F7', muted:'#8E8E93', red:'#FF453A' }
let T = {...T_LIGHT}

const Logo = () => (
  <div style={{ textAlign:'center', marginBottom:32 }}>
    <div style={{
      display:'inline-flex', flexDirection:'column', alignItems:'center',
      background:'#000', borderRadius:'50%',
      border:`4px solid ${T.accent}`,
      padding:'18px 36px 14px',
      boxShadow:`0 0 0 2px ${T.bg}, 0 0 0 5px ${T.accent}60, 0 4px 16px rgba(0,0,0,0.15)`,
    }}>
      <div style={{ fontSize:26, fontWeight:900, letterSpacing:4, color:'#FFFFFF', fontFamily:'Barlow Condensed, sans-serif', lineHeight:1 }}>DE JONGE</div>
      <div style={{ width:'80%', height:1, background:T.accent, margin:'6px 0 5px' }}/>
      <div style={{ fontSize:11, fontWeight:600, letterSpacing:6, color:'#FFFFFF', fontFamily:'Barlow Condensed, sans-serif' }}>MOTOREN</div>
    </div>
  </div>
)

const leegReg = { voornaam:'', achternaam:'', telefoon:'', adres:'', woonplaats:'' }

export default function LoginScreen() {
  const [isDark, setIsDark] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = e => setIsDark(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  Object.assign(T, isDark ? T_DARK : T_LIGHT)

  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [ww, setWw] = useState('')
  const [ww2, setWw2] = useState('')
  const [reg, setReg] = useState(leegReg)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState(null)

  const setR = k => e => setReg(p => ({...p, [k]: e.target.value}))

  // font-size 16px voorkomt automatisch inzoomen op iOS
  const inp = {
    width:'100%', background:T.surf2, border:`1px solid ${T.border}`,
    borderRadius:6, padding:'12px 14px', color:T.text,
    fontSize:16, fontFamily:'Barlow, sans-serif', outline:'none',
    boxSizing:'border-box', marginBottom:10, WebkitAppearance:'none',
  }
  const inp2 = { ...inp, width:'calc(50% - 5px)', display:'inline-block' }
  const btn = (color=T.accent) => ({
    width:'100%', padding:14, background:color, color:'#fff', border:'none',
    borderRadius:8, fontSize:16, fontWeight:600, cursor:'pointer',
    fontFamily:'Barlow, sans-serif', marginTop:4,
  })
  const lbl = { fontSize:12, color:T.muted, display:'block', marginBottom:4, letterSpacing:0.3 }
  const wrap = { display:'flex', alignItems:'flex-start', justifyContent:'center', minHeight:'100dvh', background:T.bg, padding:'20px 16px', fontFamily:'Barlow, sans-serif', boxSizing:'border-box' }
  const card = { background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:'24px 20px' }

  const login = async () => {
    if (!email || !ww) return
    setLaden(true); setFout(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: ww })
    setLaden(false)
    if (error) setFout('E-mailadres of wachtwoord klopt niet.')
  }

  const registreer = async () => {
    if (!reg.voornaam.trim()) { setFout('Vul je voornaam in.'); return }
    if (!reg.achternaam.trim()) { setFout('Vul je achternaam in.'); return }
    if (!reg.telefoon.trim()) { setFout('Vul je telefoonnummer in.'); return }
    if (!email) { setFout('Vul je e-mailadres in.'); return }
    if (!ww) return
    if (ww.length < 8) { setFout('Wachtwoord minimaal 8 tekens.'); return }
    if (ww !== ww2) { setFout('Wachtwoorden komen niet overeen.'); return }
    setLaden(true); setFout(null)
    const { error } = await supabase.auth.signUp({
      email,
      password: ww,
      options: {
        data: {
          voornaam: reg.voornaam.trim(),
          achternaam: reg.achternaam.trim(),
          telefoon: reg.telefoon.trim(),
          adres: reg.adres.trim(),
          woonplaats: reg.woonplaats.trim(),
        }
      }
    })
    setLaden(false)
    if (error) { setFout('Fout: ' + error.message); return }
    setTab('register_ok')
  }

  const resetWW = async () => {
    if (!email) { setFout('Vul eerst je e-mailadres in.'); return }
    setLaden(true); setFout(null)
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setLaden(false)
    setTab('reset_ok')
  }

  if (tab === 'reset_ok') return (
    <div style={wrap}>
      <div style={{ width:'100%', maxWidth:440 }}>
        <Logo/>
        <div style={{ ...card, textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>✉️</div>
          <div style={{ fontSize:16, fontWeight:600, color:T.text, marginBottom:8 }}>Reset-mail verstuurd</div>
          <div style={{ fontSize:14, color:T.muted, lineHeight:1.7 }}>Check je e-mail op <span style={{ color:T.text }}>{email}</span></div>
          <div style={{ marginTop:16, fontSize:13, color:T.muted, cursor:'pointer', textDecoration:'underline' }} onClick={() => setTab('login')}>← Terug naar inloggen</div>
        </div>
      </div>
    </div>
  )

  if (tab === 'register_ok') return (
    <div style={wrap}>
      <div style={{ width:'100%', maxWidth:440 }}>
        <Logo/>
        <div style={{ ...card, textAlign:'center' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
          <div style={{ fontSize:16, fontWeight:600, color:T.text, marginBottom:8 }}>Account aangemaakt!</div>
          <div style={{ fontSize:14, color:T.muted, lineHeight:1.7, marginBottom:16 }}>
            Welkom, <strong style={{ color:T.text }}>{reg.voornaam}</strong>! Bevestig je e-mailadres via de link die we gestuurd hebben naar <span style={{ color:T.text }}>{email}</span>.<br/><br/>
            Daarna kun je inloggen. Je account wordt na controle geactiveerd.
          </div>
          <button style={{ ...btn(), marginTop:0 }} onClick={() => setTab('login')}>Naar inloggen →</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={wrap}>
      <div style={{ width:'100%', maxWidth:440 }}>
        <Logo/>

        <div style={card}>
          {/* Tab switcher */}
          <div style={{ display:'flex', marginBottom:20, background:T.surf2, borderRadius:6, padding:3 }}>
            {[['login','Inloggen'],['register','Nieuw account']].map(([id,lbl2]) => (
              <button key={id} onClick={() => { setTab(id); setFout(null) }}
                style={{ flex:1, padding:'9px', background:tab===id?T.accent:'transparent', color:tab===id?'#fff':T.muted, border:'none', borderRadius:4, fontSize:14, fontWeight:tab===id?600:400, cursor:'pointer', fontFamily:'Barlow, sans-serif' }}>
                {lbl2}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <>
              <div style={{ fontSize:14, color:T.muted, marginBottom:16, lineHeight:1.6 }}>Vul je e-mailadres en wachtwoord in.</div>
              <input style={inp} type="email" inputMode="email" autoComplete="email" placeholder="jouw@email.nl"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key==='Enter' && login()}/>
              <input style={inp} type="password" autoComplete="current-password" placeholder="Wachtwoord"
                value={ww} onChange={e => setWw(e.target.value)}
                onKeyDown={e => e.key==='Enter' && login()}/>
            </>
          ) : (
            <>
              <div style={{ fontSize:14, color:T.muted, marginBottom:16, lineHeight:1.6 }}>Maak een account aan. Vul je gegevens in.</div>

              {/* Naam */}
              <div style={{ display:'flex', gap:10, marginBottom:0 }}>
                <div style={{ flex:1 }}>
                  <label style={lbl}>Voornaam *</label>
                  <input style={{...inp, marginBottom:10}} type="text" autoComplete="given-name" placeholder="Jan"
                    value={reg.voornaam} onChange={setR('voornaam')}/>
                </div>
                <div style={{ flex:1 }}>
                  <label style={lbl}>Achternaam *</label>
                  <input style={{...inp, marginBottom:10}} type="text" autoComplete="family-name" placeholder="de Vries"
                    value={reg.achternaam} onChange={setR('achternaam')}/>
                </div>
              </div>

              {/* Telefoon */}
              <label style={lbl}>Telefoonnummer *</label>
              <input style={inp} type="tel" inputMode="tel" autoComplete="tel" placeholder="06 12345678"
                value={reg.telefoon} onChange={setR('telefoon')}/>

              {/* Adres */}
              <label style={lbl}>Adres</label>
              <input style={inp} type="text" autoComplete="street-address" placeholder="Straatnaam 1"
                value={reg.adres} onChange={setR('adres')}/>

              {/* Woonplaats */}
              <label style={lbl}>Woonplaats</label>
              <input style={inp} type="text" autoComplete="address-level2" placeholder="Amsterdam"
                value={reg.woonplaats} onChange={setR('woonplaats')}/>

              <div style={{ height:1, background:T.border, margin:'4px 0 14px' }}/>

              {/* E-mail + wachtwoord */}
              <label style={lbl}>E-mailadres *</label>
              <input style={inp} type="email" inputMode="email" autoComplete="email" placeholder="jouw@email.nl"
                value={email} onChange={e => setEmail(e.target.value)}/>
              <label style={lbl}>Wachtwoord * <span style={{ fontWeight:400 }}>(minimaal 8 tekens)</span></label>
              <input style={inp} type="password" autoComplete="new-password" placeholder="Wachtwoord"
                value={ww} onChange={e => setWw(e.target.value)}/>
              <label style={lbl}>Wachtwoord herhalen *</label>
              <input style={{...inp, marginBottom:4}} type="password" autoComplete="new-password" placeholder="Zelfde wachtwoord"
                value={ww2} onChange={e => setWw2(e.target.value)}
                onKeyDown={e => e.key==='Enter' && registreer()}/>
            </>
          )}

          {fout && <div style={{ fontSize:13, color:T.red, marginBottom:10, marginTop:4 }}>{fout}</div>}

          <button style={{ ...btn(), opacity:laden?0.5:1, marginTop:8 }}
            onClick={tab==='login' ? login : registreer}
            disabled={laden}>
            {laden ? 'Bezig...' : tab==='login' ? 'Inloggen →' : 'Account aanmaken →'}
          </button>

          {tab==='login' && (
            <div style={{ textAlign:'center', marginTop:16, fontSize:13, color:T.muted, cursor:'pointer', textDecoration:'underline' }} onClick={resetWW}>
              Wachtwoord vergeten?
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
