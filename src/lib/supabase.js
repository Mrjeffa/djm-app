import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xftnovnldcdfohqlqgor.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdG5vdm5sZGNkZm9ocWxxZ29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzODU2NzQsImV4cCI6MjA5NTk2MTY3NH0.5Qgfipldcz_YrODg5HT25h0nkIfJMzMiW2ChQO57wfM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Auth ─────────────────────────────────────────────────────
export const stuurMagicLink = (email) =>
  supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })

export const uitloggen = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

// ── Klanten ──────────────────────────────────────────────────
export const getKlanten = () =>
  supabase.from('klanten').select('*, motoren(*)').order('naam')

export const addKlant = (data) =>
  supabase.from('klanten').insert(data).select().single()

export const updateKlant = (id, data) =>
  supabase.from('klanten').update(data).eq('id', id)

// ── Motoren ──────────────────────────────────────────────────
export const addMotor = (data) =>
  supabase.from('motoren').insert(data).select().single()

export const updateMotor = (id, data) =>
  supabase.from('motoren').update(data).eq('id', id)

// ── Km historie ──────────────────────────────────────────────
export const addKmStand = (motor_id, km) =>
  supabase.from('km_historie').insert({ motor_id, km, datum: new Date().toISOString().split('T')[0] })

export const getKmHistorie = (motor_id) =>
  supabase.from('km_historie').select('*').eq('motor_id', motor_id).order('datum')

// ── Service ──────────────────────────────────────────────────
export const addServiceBeurt = (data) =>
  supabase.from('service_beurten').insert(data).select().single()

export const getServiceBeurten = (motor_id) =>
  supabase.from('service_beurten').select('*').eq('motor_id', motor_id).order('datum', { ascending: false })

// ── Voorraad ─────────────────────────────────────────────────
export const getVoorraad = () =>
  supabase.from('voorraad').select('*').is('verkocht_op', null).order('created_at', { ascending: false })

export const addVoorraad = (data) =>
  supabase.from('voorraad').insert(data).select().single()

export const verkoopVoorraad = (id, klant_id) =>
  supabase.from('voorraad').update({ verkocht_op: new Date().toISOString().split('T')[0], verkocht_aan: klant_id }).eq('id', id)

// ── Afspraken ────────────────────────────────────────────────
export const getAfspraken = () =>
  supabase.from('afspraken').select('*, klanten(naam), motoren(kenteken, merk, model)').order('datum')

export const addAfspraak = (data) =>
  supabase.from('afspraken').insert(data).select().single()

export const getBezetteDagen = () =>
  supabase.from('afspraken').select('datum').gte('datum', new Date().toISOString().split('T')[0])

// ── Instellingen ─────────────────────────────────────────────
export const getInstellingen = () =>
  supabase.from('instellingen').select('*').single()

export const updateInstellingen = (data) =>
  supabase.from('instellingen').update(data).eq('id', 1)

// ── Admin check ───────────────────────────────────────────────
export const isAdmin = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from('admins').select('id').eq('id', user.id).single()
  return !!data
}
