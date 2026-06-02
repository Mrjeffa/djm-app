import { useState, useEffect } from 'react'
import { supabase, isAdmin } from './lib/supabase.js'
import AdminApp from './components/AdminApp.jsx'
import KlantApp from './components/KlantApp.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import WachtwoordInstellen from './components/WachtwoordInstellen.jsx'

// Lees hash VOOR Supabase of React iets doet
const IS_RECOVERY = window.location.hash.includes('type=recovery')

const koppelKlantAanUser = async (user) => {
  try {
    const { data: klant } = await supabase.from('klanten').select('id, user_id').eq('email', user.email).single()
    if (klant && !klant.user_id) await supabase.from('klanten').update({ user_id: user.id }).eq('id', klant.id)
  } catch { }
}

export default function App() {
  const [sessie, setSessie] = useState(null)
  const [adminModus, setAdminModus] = useState(false)
  const [laden, setLaden] = useState(!IS_RECOVERY)
  const [resetModus, setResetModus] = useState(IS_RECOVERY)

  const checkAdmin = async (session) => {
    if (!session) return false
    try { return await isAdmin() } catch { return false }
  }

  useEffect(() => {
    if (IS_RECOVERY) { setLaden(false); return }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSessie(session)
      if (session) {
        await koppelKlantAanUser(session.user)
        const admin = await checkAdmin(session)
        setAdminModus(admin)
      }
      setLaden(false)
    }).catch(() => setLaden(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setResetModus(true); setLaden(false); return }
      if (event === 'SIGNED_OUT') { setSessie(null); setAdminModus(false); setResetModus(false); setLaden(false); return }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!IS_RECOVERY) setResetModus(false)
        setSessie(session)
        if (session) {
          if (event === 'SIGNED_IN') await koppelKlantAanUser(session.user)
          setAdminModus(await checkAdmin(session))
        }
        setLaden(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  if (laden) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0E0E0E' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:32, height:32, border:'3px solid #E8520A', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
        <div style={{ color:'#666660', fontSize:13, fontFamily:'sans-serif' }}>Laden...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (resetModus) return <WachtwoordInstellen onKlaar={() => { setResetModus(false); window.location.hash = ''; window.location.reload(); }} />
  if (!sessie) return <LoginScreen />
  if (adminModus) return <AdminApp />
  return <KlantApp userId={sessie.user.id} />
}
