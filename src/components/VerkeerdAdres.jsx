// Waarschuwing als de app op een deploy- of testadres draait (zie lib/appAdres.js): daar
// komen nooit updates. Met een knop naar het vaste adres. "Verbergen" geldt tot de app sluit.
import { useState } from "react";
import { APP_URL, isDeployAdres } from "../lib/appAdres.js";

const SLEUTEL = "djm-verkeerd-adres-verborgen";
const leesVerborgen = () => { try { return sessionStorage.getItem(SLEUTEL) === "1"; } catch { return false; } };

export default function VerkeerdAdres() {
  const [verborgen, setVerborgen] = useState(leesVerborgen);
  if (!isDeployAdres() || verborgen) return null;
  const verberg = () => { try { sessionStorage.setItem(SLEUTEL, "1"); } catch { /* geen opslag: alleen nu verbergen */ } setVerborgen(true); };
  return (
    <div role="alert"
      style={{
        position: "fixed", left: 12, right: 12, top: "calc(env(safe-area-inset-top, 0px) + 10px)", zIndex: 1001,
        margin: "0 auto", maxWidth: 460, background: "#7A1013", color: "#fff", borderRadius: 10,
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)", padding: "12px 14px", fontFamily: "Barlow, sans-serif",
      }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Verkeerd adres: deze versie krijgt geen updates</div>
      <div style={{ fontSize: 12, color: "#F3D0D1", marginTop: 3, lineHeight: 1.5 }}>
        Je gebruikt een vast adres van één oude versie ({window.location.hostname}). Open de app via
        {" "}<strong>{new URL(APP_URL).hostname}</strong>, log daar in en zet hem opnieuw op je beginscherm.
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
        <button type="button" onClick={verberg}
          style={{ background: "transparent", border: "none", color: "#F3D0D1", fontSize: 13, cursor: "pointer", padding: "8px 4px", fontFamily: "inherit" }}>
          Verbergen
        </button>
        <a href={APP_URL}
          style={{ background: "#fff", color: "#7A1013", fontSize: 14, fontWeight: 700, padding: "9px 14px", borderRadius: 6, textDecoration: "none" }}>
          Open de juiste app
        </a>
      </div>
    </div>
  );
}
