import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'
import AdminApp from './components/AdminApp.jsx'
import KlantApp from './components/KlantApp.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import WachtwoordInstellen from './components/WachtwoordInstellen.jsx'

const IS_RECOVERY = window.location.hash.includes('type=recovery')

// Elke async operatie heeft max 5 sec
const tijdelijk = (fn, fallback) =>
  Promise.race([
    fn().catch(() => fallback),
    new Promise(r => setTimeout(() => r(fallback), 5000))
  ])

const checkIsAdmin = () =>
  tijdelijk(async () => {
    const { data } = await supabase.from('admins').select('id').eq('id', (await supabase.auth.getUser()).data?.user?.id).single()
    return !!data
  }, false)

const koppelKlant = (user) =>
  tijdelijk(async () => {
    const { data: k } = await supabase.from('klanten').select('id,user_id').eq('email', user.email).single()
    if (k && !k.user_id) await supabase.from('klanten').update({ user_id: user.id, status: 'in_afwachting' }).eq('id', k.id)
  }, null)

export default function App() {
  const [sessie, setSessie] = useState(null)
  const [admin, setAdmin] = useState(false)
  const [laden, setLaden] = useState(!IS_RECOVERY)
  const [reset, setReset] = useState(IS_RECOVERY)

  const verwerkSessie = async (session) => {
    if (!session) { setLaden(false); return }
    setSessie(session)
    await koppelKlant(session.user)
    setAdmin(await checkIsAdmin())
    setLaden(false)
  }

  useEffect(() => {
    if (IS_RECOVERY) { setLaden(false); return }

    // Haal sessie op — max 6 sec, daarna gewoon inlogscherm tonen
    tijdelijk(() => supabase.auth.getSession(), { data: { session: null } })
      .then(r => verwerkSessie(r?.data?.session || null))
      .catch(() => setLaden(false))

    // Luister naar auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setReset(true); setLaden(false) }
      else if (event === 'SIGNED_OUT') { setSessie(null); setAdmin(false); setReset(false); setLaden(false) }
      else if (event === 'SIGNED_IN') { await verwerkSessie(session) }
      else if (event === 'TOKEN_REFRESHED') { setSessie(session); setLaden(false) }
    })

    // Harde vangnet: na 12 sec altijd doorgaan
    const vannet = setTimeout(() => setLaden(false), 12000)
    return () => { subscription.unsubscribe(); clearTimeout(vannet) }
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

  if (reset) return <WachtwoordInstellen onKlaar={() => { setReset(false); window.location.hash = ''; window.location.reload() }} />
  if (!sessie) return <LoginScreen />
  if (admin) return <AdminApp />
  return <KlantApp userId={sessie.user.id} />
}
