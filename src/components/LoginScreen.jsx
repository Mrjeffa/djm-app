import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const T = { bg:'#0E0E0E', surf:'#161616', border:'#2A2A2A', accent:'#E8520A', text:'#F0ECE6', muted:'#666660', red:'#EF4444', green:'#22C55E' }
const inp = { width:'100%', background:'#1E1E1E', border:`1px solid #2A2A2A`, borderRadius:6, padding:'11px 14px', color:'#F0ECE6', fontSize:15, fontFamily:'Barlow, sans-serif', outline:'none', boxSizing:'border-box', marginBottom:10 }
const btn = (color='#E8520A') => ({ width:'100%', padding:13, background:color, color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'Barlow, sans-serif', marginTop:4 })
const card = { width:'100%', maxWidth:380, background:'#161616', border:`1px solid #2A2A2A`, borderRadius:10, padding:28 }

export default function LoginScreen() {
  const [tab, setTab] = useState('login') // login | register | reset_ok | register_ok
  const [email, setEmail] = useState('')
  const [ww, setWw] = useState('')
  const [ww2, setWw2] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState(null)

  const login = async () => {
    if (!email || !ww) return
    setLaden(true); setFout(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: ww })
    setLaden(false)
    if (error) setFout('E-mailadres of wachtwoord klopt niet.')
  }

  const registreer = async () => {
    if (!email || !ww) return
    if (ww.length < 8) { setFout('Wachtwoord minimaal 8 tekens.'); return }
    if (ww !== ww2) { setFout('Wachtwoorden komen niet overeen.'); return }
    setLaden(true); setFout(null)
    const { error } = await supabase.auth.signUp({ email, password: ww })
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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:T.bg, padding:20, fontFamily:'Barlow, sans-serif' }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:900, letterSpacing:3, color:T.text, fontFamily:'Barlow Condensed, sans-serif' }}>DE JONGE</div>
          <div style={{ fontSize:13, fontWeight:600, letterSpacing:5, color:T.accent, marginTop:4, fontFamily:'Barlow Condensed, sans-serif' }}>MOTOREN</div>
        </div>
        <div style={{...card, textAlign:'center'}}>
          <div style={{fontSize:36,marginBottom:12}}>✉️</div>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:8}}>Reset-mail verstuurd</div>
          <div style={{fontSize:13,color:T.muted,lineHeight:1.7}}>Check je e-mail op <span style={{color:T.text}}>{email}</span></div>
          <div style={{marginTop:16,fontSize:12,color:T.muted,cursor:'pointer',textDecoration:'underline'}} onClick={()=>setTab('login')}>← Terug naar inloggen</div>
        </div>
      </div>
    </div>
  )

  if (tab === 'register_ok') return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:T.bg, padding:20, fontFamily:'Barlow, sans-serif' }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:900, letterSpacing:3, color:T.text, fontFamily:'Barlow Condensed, sans-serif' }}>DE JONGE</div>
          <div style={{ fontSize:13, fontWeight:600, letterSpacing:5, color:T.accent, marginTop:4, fontFamily:'Barlow Condensed, sans-serif' }}>MOTOREN</div>
        </div>
        <div style={{...card, textAlign:'center'}}>
          <div style={{fontSize:36,marginBottom:12}}>✅</div>
          <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:8}}>Account aangemaakt!</div>
          <div style={{fontSize:13,color:T.muted,lineHeight:1.7,marginBottom:16}}>
            Bevestig je e-mailadres via de link die we hebben gestuurd naar <span style={{color:T.text}}>{email}</span>.<br/><br/>
            Daarna kun je inloggen.
          </div>
          <button style={{...btn(), marginTop:0}} onClick={()=>setTab('login')}>Naar inloggen →</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:T.bg, padding:20, fontFamily:'Barlow, sans-serif' }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:900, letterSpacing:3, color:T.text, fontFamily:'Barlow Condensed, sans-serif' }}>DE JONGE</div>
          <div style={{ fontSize:13, fontWeight:600, letterSpacing:5, color:T.accent, marginTop:4, fontFamily:'Barlow Condensed, sans-serif' }}>MOTOREN</div>
        </div>

        <div style={card}>
          {/* Tab switcher */}
          <div style={{display:'flex',gap:0,marginBottom:20,background:'#1E1E1E',borderRadius:6,padding:3}}>
            {[['login','Inloggen'],['register','Nieuw account']].map(([id,lbl])=>(
              <button key={id} onClick={()=>{setTab(id);setFout(null)}}
                style={{flex:1,padding:'8px',background:tab===id?T.accent:'transparent',color:tab===id?'#fff':T.muted,border:'none',borderRadius:4,fontSize:13,fontWeight:tab===id?600:400,cursor:'pointer',fontFamily:'Barlow, sans-serif'}}>
                {lbl}
              </button>
            ))}
          </div>

          <div style={{fontSize:13,color:T.muted,marginBottom:16,lineHeight:1.6}}>
            {tab==='login' ? 'Vul je e-mailadres en wachtwoord in.' : 'Maak een account aan met je e-mailadres.'}
          </div>

          <input style={inp} type="email" placeholder="jouw@email.nl" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(tab==='login'?login():registreer())}/>
          <input style={inp} type="password" placeholder="Wachtwoord" value={ww} onChange={e=>setWw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(tab==='login'?login():registreer())}/>
          {tab==='register' && <input style={inp} type="password" placeholder="Herhaal wachtwoord" value={ww2} onChange={e=>setWw2(e.target.value)} onKeyDown={e=>e.key==='Enter'&&registreer()}/>}

          {fout && <div style={{fontSize:12,color:T.red,marginBottom:10}}>{fout}</div>}

          <button style={{...btn(), opacity:laden||!email||!ww?0.5:1}} onClick={tab==='login'?login:registreer} disabled={laden||!email||!ww}>
            {laden ? 'Bezig...' : tab==='login' ? 'Inloggen →' : 'Account aanmaken →'}
          </button>

          {tab==='login' && (
            <div style={{textAlign:'center',marginTop:14,fontSize:12,color:T.muted,cursor:'pointer',textDecoration:'underline'}} onClick={resetWW}>
              Wachtwoord vergeten?
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
