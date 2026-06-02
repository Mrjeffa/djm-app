import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const T = {
  bg:'#0E0E0E', surf:'#161616', border:'#2A2A2A',
  accent:'#E8520A', text:'#F0ECE6', muted:'#666660', red:'#EF4444'
}

const s = {
  wrap: { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:T.bg, padding:20, fontFamily:'sans-serif' },
  logo: { textAlign:'center', marginBottom:32 },
  logoTop: { fontSize:28, fontWeight:900, letterSpacing:3, color:T.text },
  logoSub: { fontSize:13, fontWeight:600, letterSpacing:5, color:T.accent, marginTop:4 },
  card: { width:'100%', maxWidth:380, background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:28 },
  input: { width:'100%', background:'#1E1E1E', border:`1px solid ${T.border}`, borderRadius:6, padding:'11px 14px', color:T.text, fontSize:15, fontFamily:'sans-serif', outline:'none', boxSizing:'border-box', marginBottom:10 },
  btn: { width:'100%', padding:13, background:T.accent, color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'sans-serif', marginTop:4 },
  fout: { fontSize:12, color:T.red, marginBottom:10 },
  link: { textAlign:'center', marginTop:14, fontSize:12, color:T.muted, cursor:'pointer', textDecoration:'underline' },
}

export default function LoginScreen() {
  const [scherm, setScherm] = useState('login') // 'login' | 'reset_verstuurd'
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState(null)

  const login = async () => {
    if (!email || !wachtwoord) return
    setLaden(true); setFout(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord })
    setLaden(false)
    if (error) setFout('E-mailadres of wachtwoord klopt niet.')
  }

  const resetWachtwoord = async () => {
    if (!email) { setFout('Vul eerst je e-mailadres in.'); return }
    setLaden(true); setFout(null)
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#reset`
    })
    setLaden(false)
    setScherm('reset_verstuurd')
  }

  if (scherm === 'reset_verstuurd') return (
    <div style={s.wrap}>
      <div>
        <div style={s.logo}>
          <div style={s.logoTop}>DE JONGE</div>
          <div style={s.logoSub}>MOTOREN</div>
        </div>
        <div style={{...s.card, textAlign:'center'}}>
          <div style={{fontSize:36, marginBottom:14}}>✉️</div>
          <div style={{fontSize:15, fontWeight:600, color:T.text, marginBottom:8}}>Reset-mail verstuurd</div>
          <div style={{fontSize:13, color:T.muted, lineHeight:1.7}}>
            Check je e-mail op <span style={{color:T.text}}>{email}</span> voor een link om je wachtwoord in te stellen.
          </div>
          <div style={s.link} onClick={()=>setScherm('login')}>← Terug naar inloggen</div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.wrap}>
      <div>
        <div style={s.logo}>
          <div style={s.logoTop}>DE JONGE</div>
          <div style={s.logoSub}>MOTOREN</div>
        </div>
        <div style={s.card}>
          <div style={{fontSize:15, fontWeight:600, color:T.text, marginBottom:6}}>Inloggen</div>
          <div style={{fontSize:13, color:T.muted, marginBottom:20, lineHeight:1.6}}>
            Vul je e-mailadres en wachtwoord in.
          </div>

          <input style={s.input} type="email" placeholder="jouw@email.nl"
            value={email} onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&login()}/>

          <input style={s.input} type="password" placeholder="Wachtwoord"
            value={wachtwoord} onChange={e=>setWachtwoord(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&login()}/>

          {fout && <div style={s.fout}>{fout}</div>}

          <button style={{...s.btn, opacity: laden||!email||!wachtwoord ? 0.5 : 1}}
            onClick={login} disabled={laden||!email||!wachtwoord}>
            {laden ? 'Bezig...' : 'Inloggen →'}
          </button>

          <div style={s.link} onClick={resetWachtwoord}>
            Wachtwoord vergeten?
          </div>
        </div>
      </div>
    </div>
  )
}
