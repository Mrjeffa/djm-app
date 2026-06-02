import { useState, useEffect } from 'react'
import { supabase, isAdmin } from './lib/supabase.js'
import AdminApp from './components/AdminApp.jsx'
import KlantApp from './components/KlantApp.jsx'
import LoginScreen from './components/LoginScreen.jsx'

export default function App() {
  const [sessie, setSessie] = useState(null)
  const [adminModus, setAdminModus] = useState(false)
  const [laden, setLaden] = useState(true)

  const checkAdmin = async (session) => {
    if (!session) return false
    try {
      return await isAdmin()
    } catch {
      return false
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSessie(session)
      if (session) {
        const admin = await checkAdmin(session)
        setAdminModus(admin)
      }
      setLaden(false)
    }).catch(() => setLaden(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSessie(session)
      if (session) {
        const admin = await checkAdmin(session)
        setAdminModus(admin)
      } else {
        setAdminModus(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (laden) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0E0E0E', fontFamily:'sans-serif' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <div style={{ width:32, height:32, border:'3px solid #E8520A', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          <div style={{ color:'#666660', fontSize:13 }}>Laden...</div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!sessie) return <LoginScreen />
  if (adminModus) return <AdminApp />
  return <KlantApp userId={sessie.user.id} />
}
