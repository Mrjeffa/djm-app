import { lazy } from 'react'

// Lazy laden met herstel na een update: bestaat een oud bestand (chunk) niet meer op de
// server, dan één keer automatisch herladen. Lukt het daarna nog niet, dan gaat de fout
// naar het foutvangnet in App.jsx.
const HERLAAD_SLEUTEL = 'djm_herladen_na_update'
export const laadMetHerstel = (laad) => lazy(() => laad().then(
  (mod) => { try { sessionStorage.removeItem(HERLAAD_SLEUTEL) } catch (_) {} return mod },
  (fout) => {
    let alGeprobeerd = true
    try { alGeprobeerd = sessionStorage.getItem(HERLAAD_SLEUTEL) === '1'; sessionStorage.setItem(HERLAAD_SLEUTEL, '1') } catch (_) {}
    if (alGeprobeerd) throw fout
    window.location.reload()
    return new Promise(() => {})
  }
))
