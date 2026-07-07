import { useState, useEffect, useRef, Component } from 'react'
import { supabase } from './lib/supabase.js'
import AdminApp from './components/AdminApp.jsx'
import KlantApp from './components/KlantApp.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import WachtwoordInstellen from './components/WachtwoordInstellen.jsx'

// ── Foutvangnet: onverwachte fout → nette herlaadpagina i.p.v. wit scherm ──
class FoutVangnet extends Component {
  constructor(props) { super(props); this.state = { fout: null } }
  static getDerivedStateFromError(fout) { return { fout } }
  componentDidCatch(fout, info) { console.error('App-fout:', fout, info?.componentStack) }
  render() {
    if (!this.state.fout) return this.props.children
    const sysDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100dvh', background:sysDark?'#111':'#F8F8F8', fontFamily:'Barlow, sans-serif', padding:24, textAlign:'center' }}>
        <div>
          <div style={{ fontSize:40, marginBottom:14 }}>🔧</div>
          <div style={{ fontSize:17, fontWeight:700, color:sysDark?'#F2F2F7':'#1A1A1A', marginBottom:8 }}>Er ging iets mis</div>
          <div style={{ fontSize:13, color:sysDark?'#8E8E93':'#767676', lineHeight:1.7, maxWidth:300, margin:'0 auto 20px' }}>
            De app liep tegen een onverwachte fout aan. Herlaad de app — je gegevens zijn veilig opgeslagen.
          </div>
          <button onClick={() => window.location.reload()}
            style={{ padding:'12px 28px', background:'#E31E24', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'Barlow, sans-serif' }}>
            Herlaad de app
          </button>
        </div>
      </div>
    )
  }
}

// Gecachte admin-hint: laadscherm voelt sneller aan bij refresh/wakeup
const ADMIN_CACHE = 'djm_admin_v1'
const getCachedAdmin = () => { try { return sessionStorage.getItem(ADMIN_CACHE) === '1' } catch (_) { return false } }
const setCachedAdmin = (v) => { try { sessionStorage.setItem(ADMIN_CACHE, v ? '1' : '0') } catch (_) {} }
const clearCachedAdmin = () => { try { sessionStorage.removeItem(ADMIN_CACHE) } catch (_) {} }

// Generiek timeout-wrapper
const tijdelijk = (fn, fallback, ms = 8000) =>
  Promise.race([
    fn().catch(() => fallback),
    new Promise(r => setTimeout(() => r(fallback), ms))
  ])

// Admin check: alleen DB query — geen extra getUser() round-trip nodig
// Geeft null terug bij timeout (onzeker), false bij zeker geen admin
const checkIsAdmin = (userId) =>
  Promise.race([
    supabase.from('admins').select('id').eq('id', userId).single()
      .then(({ data }) => { const r = !!data; setCachedAdmin(r); return r })
      .catch(() => false),
    new Promise(r => setTimeout(() => r(null), 8000))
  ])

const koppelKlant = (user) =>
  tijdelijk(async () => {
    const { data: k } = await supabase.from('klanten').select('id,user_id').eq('email', user.email).single()
    if (k && !k.user_id) {
      await supabase.from('klanten').update({ user_id: user.id, status: 'in_afwachting' }).eq('id', k.id)
    } else if (!k) {
      const meta = user.user_metadata || {}
      const naam = [meta.voornaam, meta.achternaam].filter(Boolean).join(' ') || user.email.split('@')[0]
      await supabase.from('klanten').insert({
        email: user.email,
        naam,
        telefoon: meta.telefoon || '',
        adres: meta.adres || '',
        woonplaats: meta.woonplaats || '',
        user_id: user.id,
        status: 'in_afwachting',
      }).single()
    }
  }, null)

export default function App() {
  return <FoutVangnet><AppInner/></FoutVangnet>
}

function AppInner() {
  const [sessie, setSessie] = useState(null)
  // Begin met gecachte admin-waarde zodat snelle refresh geen laadscherm toont
  const [admin, setAdmin] = useState(getCachedAdmin)
  const [laden, setLaden] = useState(true)
  const [reset, setReset] = useState(false)
  const bezig = useRef(false)
  const inReset = useRef(false)
  const heeftSessie = useRef(false)

  // Verwerk admin-resultaat: null (timeout) = onzeker, behoud huidige waarde
  const verwerkAdmin = (isAdmin) => {
    if (isAdmin === null) return
    setAdmin(isAdmin)
    setCachedAdmin(isAdmin)
  }

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
    verwerkAdmin(await checkIsAdmin(session.user.id))
    heeftSessie.current = true
    bezig.current = false
    setLaden(false)
  }

  useEffect(() => {
    const isRecovery = window.location.hash.includes('type=recovery')

    if (!isRecovery) {
      tijdelijk(() => supabase.auth.getSession(), { data: { session: null } }, 8000)
        .then(r => verwerkSessie(r?.data?.session || null))
        .catch(() => setLaden(false))
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        inReset.current = true
        setReset(true)
        setLaden(false)
      } else if (event === 'SIGNED_OUT') {
        bezig.current = false
        inReset.current = false
        heeftSessie.current = false
        setSessie(null)
        setAdmin(false)
        setReset(false)
        setLaden(false)
        clearCachedAdmin()
      } else if (event === 'SIGNED_IN' && !inReset.current) {
        if (heeftSessie.current) {
          // Stille update bij app-wisselen of schermvergrendeling — geen laadscherm
          setSessie(session)
          // Herbevestig admin op achtergrond; null-timeout doet niets
          checkIsAdmin(session.user.id).then(verwerkAdmin).catch(() => {})
        } else {
          await verwerkSessie(session)
        }
      } else if (event === 'TOKEN_REFRESHED') {
        setSessie(session)
      }
    })

    // Vangnet: na 12s altijd doorgaan + reset bezig zodat events niet geblokkeerd raken
    // Na 12s altijd laden stoppen. heeftSessie op true zodat SIGNED_IN daarna
    // nooit meer een nieuw laadscherm start — anders loopt het in cirkels.
    const vannet = setTimeout(() => { setLaden(false); heeftSessie.current = true }, 12000)
    return () => { subscription.unsubscribe(); clearTimeout(vannet) }
  }, [])

  if (laden) {
    const sysDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100dvh', background: sysDark ? '#111111' : '#F8F8F8' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <div style={{ width:32, height:32, border:'3px solid #E31E24', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
          <div style={{ color: sysDark ? '#8E8E93' : '#767676', fontSize:13, fontFamily:'Barlow, sans-serif' }}>Laden...</div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (reset) return <WachtwoordInstellen onKlaar={() => { setReset(false); window.location.hash = ''; window.location.reload() }} />
  if (!sessie) return <LoginScreen />
  if (admin) return <AdminApp />
  return <KlantApp userId={sessie.user.id} />
}
