import { useState, useEffect } from 'react'
import { supabase, isAdmin } from './lib/supabase.js'
import AdminApp from './components/AdminApp.jsx'
import KlantApp from './components/KlantApp.jsx'
import LoginScreen from './components/LoginScreen.jsx'

export default function App() {
  const [sessie, setSessie] = useState(null)
  const [adminModus, setAdminModus] = useState(false)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSessie(session)
      if (session) {
        const admin = await isAdmin()
        setAdminModus(admin)
      }
      setLaden(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSessie(session)
      if (session) {
        const admin = await isAdmin()
        setAdminModus(admin)
      } else {
        setAdminModus(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (laden) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0E0E0E', color:'#E8520A', fontFamily:'sans-serif', fontSize:14 }}>
        Laden...
      </div>
    )
  }

  if (!sessie) return <LoginScreen />
  if (adminModus) return <AdminApp />
  return <KlantApp userId={sessie.user.id} />
}
