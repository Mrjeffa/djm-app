// Instellingen → App-versie: welke versie draait er, en handmatig zoeken naar een update.
// Werkt in de beheer-app en in het klantportaal (eigen kleuren via T).
import { useState } from "react";
import { versieTekst, zoekUpdate, laadNieuweVersie } from "../lib/versie.js";
import { APP_URL, isDeployAdres } from "../lib/appAdres.js";

export default function AppVersie({ T }) {
  const [status, setStatus] = useState(null); // null | "bezig" | "nieuw" | "nieuwste" | "onbekend"
  const zoek = async () => {
    setStatus("bezig");
    setStatus(await zoekUpdate());
  };
  const knop = {
    background: "transparent", border: `1px solid ${T.border}`, color: T.text, borderRadius: 6,
    padding: "8px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  };
  return (
    <div>
      <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
        Versie van <span style={{ color: T.text }}>{versieTekst()}</span>
        <br />Adres: <span style={{ color: isDeployAdres() ? T.red : T.text }}>{window.location.hostname}</span>
      </div>
      {isDeployAdres() && (
        <div style={{ fontSize: 12, color: T.red, marginTop: 6, lineHeight: 1.5 }}>
          Dit adres hoort bij één vaste versie en krijgt nooit updates. Gebruik{" "}
          <a href={APP_URL} style={{ color: T.red, fontWeight: 700 }}>{new URL(APP_URL).hostname}</a>.
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        {status === "nieuw" ? (
          <button type="button" onClick={laadNieuweVersie} style={{ ...knop, background: T.accent, borderColor: T.accent, color: "#fff", fontWeight: 600 }}>
            Nieuwe versie laden
          </button>
        ) : (
          <button type="button" onClick={zoek} disabled={status === "bezig"} style={knop}>
            {status === "bezig" ? "Zoeken…" : "Zoeken naar update"}
          </button>
        )}
        {status === "nieuwste" && <span style={{ fontSize: 12, color: T.green }}>✓ Je hebt de nieuwste versie</span>}
        {status === "nieuw" && <span style={{ fontSize: 12, color: T.accent }}>Er staat een nieuwe versie klaar</span>}
        {status === "onbekend" && <span style={{ fontSize: 12, color: T.muted }}>Kon niet controleren (geen internet?). Probeer het later opnieuw.</span>}
      </div>
    </div>
  );
}
