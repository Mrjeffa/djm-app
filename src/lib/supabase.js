import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xftnovnldcdfohqlqgor.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdG5vdm5sZGNkZm9ocWxxZ29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODU2NzQsImV4cCI6MjA5NTk2MTY3NH0.5Qgfipldcz_YrODg5HT25h0nkIfJMzMiW2ChQO57wfM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})

// ── Auth ─────────────────────────────────────────────────────
export const stuurUitnodiging = (email) =>
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  })

// Uitloggen meldt ook de pushmeldingen van dit apparaat af: anders blijft een gedeeld of
// overgedragen apparaat beheerdersmeldingen krijgen. Hooguit 3 s wachten, daarna gewoon uitloggen.
const pushAfmelden = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null
  if (!sub) return
  await supabase.from('push_abonnementen').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
export const uitloggen = async () => {
  try { await Promise.race([pushAfmelden(), new Promise(r => setTimeout(r, 3000))]) } catch { /* geen push */ }
  return supabase.auth.signOut()
}

// Overige data-toegang staat in de componenten zelf (AdminApp/KlantApp) en gaat
// via dit ene `supabase`-object; wat iemand mag lezen/schrijven bepaalt RLS in de
// database (zie docs/ARCHITECTUUR.md). Volle dagen: supabase.rpc('get_bezette_dagen').
