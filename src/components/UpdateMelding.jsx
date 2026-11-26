// Melding "Nieuwe versie beschikbaar" voor iedereen (inlogscherm, klantportaal, beheer-app).
// Herlaadt pas als de gebruiker op Vernieuwen tikt: zo raakt niemand een half ingevuld
// formulier kwijt. "Later" verbergt de melding tot de volgende controle (bv. bij het weer
// openen van de app).
import { useEffect, useState } from "react";
import { laadNieuweVersie, volgVersie } from "../lib/versie.js";

export default function UpdateMelding() {
  const [nieuw, setNieuw] = useState(false);
  const [later, setLater] = useState(false);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;
    return volgVersie(() => { setNieuw(true); setLater(false); });
  }, []);

  if (!nieuw || later) return null;
  return (
    <div role="status" aria-live="polite"
      style={{
        position: "fixed", left: 12, right: 12, top: "calc(env(safe-area-inset-top, 0px) + 10px)", zIndex: 1000,
        margin: "0 auto", maxWidth: 460, background: "#1A1A1A", color: "#fff", borderRadius: 10,
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)", padding: "12px 14px", display: "flex", alignItems: "center",
        gap: 12, fontFamily: "Barlow, sans-serif", border: "1px solid #38383A",
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Nieuwe versie beschikbaar</div>
        <div style={{ fontSize: 12, color: "#B8B8BD", marginTop: 2 }}>Vernieuw de app om de laatste versie te gebruiken.</div>
      </div>
      <button type="button" onClick={() => setLater(true)}
        style={{ background: "transparent", border: "none", color: "#B8B8BD", fontSize: 13, cursor: "pointer", padding: "8px 4px", fontFamily: "inherit" }}>
        Later
      </button>
      <button type="button" disabled={bezig} onClick={() => { setBezig(true); laadNieuweVersie(); }}
        style={{ background: "#E31E24", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "9px 14px", borderRadius: 6, fontFamily: "inherit", whiteSpace: "nowrap" }}>
        {bezig ? "Laden…" : "Vernieuwen"}
      </button>
    </div>
  );
}
