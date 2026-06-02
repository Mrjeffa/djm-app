import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const T = { bg:'#0E0E0E', surf:'#161616', border:'#2A2A2A', accent:'#E8520A', text:'#F0ECE6', muted:'#666660', red:'#EF4444', green:'#22C55E' }

export default function WachtwoordInstellen({ onKlaar }) {
  const [wachtwoord, setWachtwoord] = useState('')
  const [herhaal, setHerhaal] = useState('')
  const [laden, setLaden] = useState(false)
  const [fout, setFout] = useState(null)
  const [klaar, setKlaar] = useState(false)

  const slaOp = async () => {
    if (wachtwoord.length < 8) { setFout('Wachtwoord moet minimaal 8 tekens zijn.'); return }
    if (wachtwoord !== herhaal) { setFout('Wachtwoorden komen niet overeen.'); return }
    setLaden(true); setFout(null)
    const { error } = await supabase.auth.updateUser({ password: wachtwoord })
    setLaden(false)
    if (error) { setFout('Fout: ' + error.message); return }
    setKlaar(true)
    setTimeout(() => onKlaar(), 2000)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:T.bg, padding:20, fontFamily:'sans-serif' }}>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:900, letterSpacing:3, color:T.text }}>DE JONGE</div>
          <div style={{ fontSize:13, fontWeight:600, letterSpacing:5, color:T.accent, marginTop:4 }}>MOTOREN</div>
        </div>
        <div style={{ background:T.surf, border:`1px solid ${T.border}`, borderRadius:10, padding:28 }}>
          {klaar ? (
            <div style={{ textAlign:'center', padding:'16px 0' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:15, fontWeight:600, color:T.text }}>Wachtwoord ingesteld!</div>
              <div style={{ fontSize:13, color:T.muted, marginTop:8 }}>Je wordt nu ingelogd...</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:6 }}>Stel je wachtwoord in</div>
              <div style={{ fontSize:13, color:T.muted, marginBottom:20, lineHeight:1.6 }}>
                Kies een wachtwoord voor je account. Minimaal 8 tekens.
              </div>
              <input style={{ width:'100%', background:'#1E1E1E', border:`1px solid ${T.border}`, borderRadius:6, padding:'11px 14px', color:T.text, fontSize:15, fontFamily:'sans-serif', outline:'none', boxSizing:'border-box', marginBottom:10 }}
                type="password" placeholder="Nieuw wachtwoord"
                value={wachtwoord} onChange={e=>setWachtwoord(e.target.value)}/>
              <input style={{ width:'100%', background:'#1E1E1E', border:`1px solid ${T.border}`, borderRadius:6, padding:'11px 14px', color:T.text, fontSize:15, fontFamily:'sans-serif', outline:'none', boxSizing:'border-box', marginBottom:10 }}
                type="password" placeholder="Herhaal wachtwoord"
                value={herhaal} onChange={e=>setHerhaal(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&slaOp()}/>
              {fout && <div style={{ fontSize:12, color:T.red, marginBottom:10 }}>{fout}</div>}
              <button onClick={slaOp} disabled={laden||!wachtwoord||!herhaal}
                style={{ width:'100%', padding:13, background:T.accent, color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'sans-serif', opacity: laden||!wachtwoord||!herhaal ? 0.5 : 1 }}>
                {laden ? 'Opslaan...' : 'Wachtwoord instellen →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
