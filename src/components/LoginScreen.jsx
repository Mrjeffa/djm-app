import { useState } from 'react'
import { stuurMagicLink } from '../lib/supabase.js'

const T = {
  bg:'#0E0E0E', surf:'#161616', border:'#2A2A2A',
  accent:'#E8520A', text:'#F0ECE6', muted:'#666660'
}

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [verstuurd, setVerstuurd] = useState(false)
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState(null)

  const verstuur = async () => {
    if (!email) return
    setLaden(true)
    setFout(null)
    const { error } = await stuurMagicLink(email)
    setLaden(false)
    if (error) {
      setFout('E-mailadres niet herkend. Neem contact op met De Jonge Motoren.')
    } else {
      setVerstuurd(true)
    }
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:T.bg, padding:20, fontFamily:'sans-serif' }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ fontSize:28, fontWeight:900, letterSpacing:3, color:T.text }}>DE JONGE</div>
          <div style={{ fontSize:13, fontWeight:600, letterSpacing:5, color:T.accent, marginTop:4 }}>MOTOREN</div>
        </div>

        {verstuurd ? (
          <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:28, textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:16 }}>✉️</div>
            <div style={{ fontSize:16, fontWeight:600, color:T.text, marginBottom:10 }}>Check je e-mail</div>
            <div style={{ fontSize:13, color:T.muted, lineHeight:1.7 }}>
              We hebben een inloglink gestuurd naar<br/>
              <span style={{ color:T.text }}>{email}</span><br/>
              Klik op de link om in te loggen.
            </div>
          </div>
        ) : (
          <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:28 }}>
            <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:6 }}>Inloggen</div>
            <div style={{ fontSize:13, color:T.muted, marginBottom:20, lineHeight:1.6 }}>
              Vul je e-mailadres in. Je ontvangt een inloglink — geen wachtwoord nodig.
            </div>

            <div style={{ marginBottom:12 }}>
              <input
                style={{ width:'100%', background:'#1E1E1E', border:`1px solid ${T.border}`, borderRadius:6, padding:'11px 14px', color:T.text, fontSize:15, fontFamily:'sans-serif', outline:'none', boxSizing:'border-box' }}
                type="email" placeholder="jouw@email.nl"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verstuur()}
              />
            </div>

            {fout && <div style={{ fontSize:12, color:'#EF4444', marginBottom:10 }}>{fout}</div>}

            <button
              onClick={verstuur} disabled={laden || !email}
              style={{ width:'100%', padding:13, background:T.accent, color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor: laden||!email ? 'default' : 'pointer', opacity: laden||!email ? 0.5 : 1, fontFamily:'sans-serif' }}>
              {laden ? 'Versturen...' : 'Stuur inloglink →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
