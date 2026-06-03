import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase.js'
import AdminApp from './components/AdminApp.jsx'
import KlantApp from './components/KlantApp.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import WachtwoordInstellen from './components/WachtwoordInstellen.jsx'

const tijdelijk = (fn, fallback) =>
  Promise.race([
    fn().catch(() => fallback),
    new Promise(r => setTimeout(() => r(fallback), 5000))
  ])

const checkIsAdmin = () =>
  tijdelijk(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase.from('admins').select('id').eq('id', user.id).single()
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
  const [laden, setLaden] = useState(true)
  const [reset, setReset] = useState(false)
  // Voorkomt dubbele verwerking van sessie (race tussen getSession + SIGNED_IN event)
  const bezig = useRef(false)
  const inReset = useRef(false)

  const verwerkSessie = async (session) => {
    if (bezig.current) return
    bezig.current = true
    if (!session) {
      bezig.current = false
      setLaden(false)
      return
    }
    setLaden(true)
    setSessie(session)
    await koppelKlant(session.user)
    setAdmin(await checkIsAdmin())
    bezig.current = false
    setLaden(false)
  }

  useEffect(() => {
    // Controleer of dit een wachtwoord-reset link is
    const isRecovery = window.location.hash.includes('type=recovery')

    if (!isRecovery) {
      // Normale flow: haal bestaande sessie op
      tijdelijk(() => supabase.auth.getSession(), { data: { session: null } })
        .then(r => verwerkSessie(r?.data?.session || null))
        .catch(() => setLaden(false))
    }
    // Bij recovery: wacht op PASSWORD_RECOVERY event (Supabase verwerkt de URL hash async)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        inReset.current = true
        setReset(true)
        setLaden(false)
      } else if (event === 'SIGNED_OUT') {
        bezig.current = false
        inReset.current = false
        setSessie(null)
        setAdmin(false)
        setReset(false)
        setLaden(false)
      } else if (event === 'SIGNED_IN' && !inReset.current) {
        await verwerkSessie(session)
      } else if (event === 'TOKEN_REFRESHED') {
        setSessie(session)
      }
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
