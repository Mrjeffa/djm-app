import { useState, useEffect } from "react";
import { isGeinstalleerd, platform, kanDirectInstalleren, installeer, opInstallWijziging } from "../lib/pwa.js";

// ── Plaatjes voor de iPhone-uitleg (getekend, zodat ze altijd scherp zijn) ──
const RAND = "#E31E24";

// Het deel-icoon van iOS: vierkantje met pijl omhoog
const DeelIcoon = ({ x, y, s = 1, kleur = "#007AFF" }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={kleur} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v9A1.5 1.5 0 0 0 5.5 22h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 18.5 10H17"/>
    <path d="M12 3v12M8 7l4-4 4 4"/>
  </g>
);

const Stap1 = () => (
  <svg viewBox="0 0 280 120" width="100%" role="img" aria-label="Safari: tik onderaan op het deel-icoon">
    <rect x="0.5" y="0.5" width="279" height="119" rx="14" fill="#F2F2F7" stroke="#D1D1D6"/>
    <rect x="40" y="18" width="200" height="24" rx="8" fill="#E5E5EA"/>
    <text x="140" y="34" textAnchor="middle" fontSize="12" fill="#3C3C43" fontFamily="-apple-system, Helvetica, Arial">De Jonge Motoren</text>
    <rect x="12" y="66" width="256" height="42" rx="10" fill="#FFFFFF" stroke="#E5E5EA"/>
    <path d="M38 80l-6 7 6 7" fill="none" stroke="#007AFF" strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M80 80l6 7-6 7" fill="none" stroke="#C7C7CC" strokeWidth="2.2" strokeLinecap="round"/>
    <circle cx="140" cy="87" r="17" fill="none" stroke={RAND} strokeWidth="3"/>
    <DeelIcoon x={128} y={74} />
    <path d="M188 80c4-2 8-2 10 1v14c-2-3-6-3-10-1zM208 80c-4-2-8-2-10 1v14c2-3 6-3 10-1z" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinejoin="round"/>
    <rect x="232" y="80" width="13" height="13" rx="2.5" fill="none" stroke="#007AFF" strokeWidth="1.8"/>
    <rect x="236" y="77" width="13" height="13" rx="2.5" fill="#FFFFFF" stroke="#007AFF" strokeWidth="1.8"/>
    <text x="140" y="56" textAnchor="middle" fontSize="13" fontWeight="700" fill={RAND} fontFamily="-apple-system, Helvetica, Arial">Tik op Delen</text>
  </svg>
);

const Stap2 = () => (
  <svg viewBox="0 0 280 150" width="100%" role="img" aria-label="Kies Zet op beginscherm in het deelmenu">
    <rect x="0.5" y="0.5" width="279" height="149" rx="14" fill="#F2F2F7" stroke="#D1D1D6"/>
    <rect x="12" y="12" width="256" height="126" rx="10" fill="#FFFFFF"/>
    <text x="26" y="40" fontSize="14" fill="#1C1C1E" fontFamily="-apple-system, Helvetica, Arial">Kopieer</text>
    <rect x="236" y="28" width="14" height="16" rx="2" fill="none" stroke="#1C1C1E" strokeWidth="1.6"/>
    <line x1="26" y1="54" x2="254" y2="54" stroke="#E5E5EA"/>
    <text x="26" y="78" fontSize="14" fill="#1C1C1E" fontFamily="-apple-system, Helvetica, Arial">Voeg toe aan leeslijst</text>
    <circle cx="243" cy="73" r="7" fill="none" stroke="#1C1C1E" strokeWidth="1.6"/>
    <line x1="26" y1="92" x2="254" y2="92" stroke="#E5E5EA"/>
    <rect x="16" y="96" width="248" height="38" rx="8" fill="#E31E2414" stroke={RAND} strokeWidth="2.5"/>
    <text x="26" y="120" fontSize="14" fontWeight="700" fill="#1C1C1E" fontFamily="-apple-system, Helvetica, Arial">Zet op beginscherm</text>
    <rect x="235" y="107" width="16" height="16" rx="3" fill="none" stroke="#1C1C1E" strokeWidth="1.6"/>
    <path d="M243 111v8M239 115h8" stroke="#1C1C1E" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

const Stap3 = () => (
  <svg viewBox="0 0 280 120" width="100%" role="img" aria-label="Tik rechtsboven op Voeg toe">
    <rect x="0.5" y="0.5" width="279" height="119" rx="14" fill="#F2F2F7" stroke="#D1D1D6"/>
    <text x="14" y="32" fontSize="12" fill="#007AFF" fontFamily="-apple-system, Helvetica, Arial">Annuleer</text>
    <text x="138" y="32" textAnchor="middle" fontSize="12" fontWeight="600" fill="#1C1C1E" fontFamily="-apple-system, Helvetica, Arial">Zet op beginscherm</text>
    <rect x="204" y="14" width="68" height="26" rx="13" fill="none" stroke={RAND} strokeWidth="2.5"/>
    <text x="238" y="32" textAnchor="middle" fontSize="12" fontWeight="700" fill="#007AFF" fontFamily="-apple-system, Helvetica, Arial">Voeg toe</text>
    <rect x="12" y="50" width="256" height="58" rx="10" fill="#FFFFFF"/>
    <image href="/icons/apple-touch-icon.png" x="24" y="58" width="42" height="42" />
    <text x="80" y="78" fontSize="14" fontWeight="600" fill="#1C1C1E" fontFamily="-apple-system, Helvetica, Arial">DJM</text>
    <text x="80" y="96" fontSize="11" fill="#8E8E93" fontFamily="-apple-system, Helvetica, Arial">De Jonge Motoren</text>
  </svg>
);

// ── Kader "App installeren" (klantportaal → instellingen) ──
export default function AppInstalleren({ T, css }) {
  const [geinstalleerd, setGeinstalleerd] = useState(isGeinstalleerd);
  const [kanDirect, setKanDirect] = useState(kanDirectInstalleren);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null);

  useEffect(() => opInstallWijziging(() => setKanDirect(kanDirectInstalleren())), []);
  useEffect(() => {
    const klaar = () => { setGeinstalleerd(true); };
    window.addEventListener("appinstalled", klaar);
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const wissel = () => setGeinstalleerd(isGeinstalleerd());
    mq?.addEventListener?.("change", wissel);
    return () => { window.removeEventListener("appinstalled", klaar); mq?.removeEventListener?.("change", wissel); };
  }, []);

  // Draait al als app vanaf het beginscherm: niets te installeren
  if (geinstalleerd) return null;

  const p = platform();
  const tekst = { fontSize: 13, color: T.muted, lineHeight: 1.6 };
  const stapLabel = { fontSize: 13, fontWeight: 600, color: T.text, margin: "12px 0 6px" };

  const startInstallatie = async () => {
    setBezig(true); setMelding(null);
    const uitkomst = await installeer();
    setBezig(false);
    if (uitkomst === "accepted") setMelding("De app wordt geïnstalleerd. Je vindt hem zo op je startscherm.");
    else if (uitkomst === "dismissed") setMelding("Geannuleerd. Je kunt het later opnieuw proberen via het menu van je browser.");
  };

  return (
    <div style={css.card}>
      <div style={css.sectionTitle}>App installeren</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <img src="/icons/icon-192.png" alt="" width="48" height="48" style={{ flexShrink: 0 }} />
        <div style={tekst}>
          Zet De Jonge Motoren op je beginscherm: met één tik open, zonder adresbalk, en je blijft ingelogd.
        </div>
      </div>

      {p.os === "ios" ? (
        <>
          {!p.safari && (
            <div style={{ ...tekst, color: T.text, background: T.surf2, borderRadius: 8, padding: "8px 10px", marginBottom: 8 }}>
              Open deze pagina eerst in <strong>Safari</strong>, dan lukt het installeren.
            </div>
          )}
          <div style={stapLabel}>1. Tik in Safari op <strong>Delen</strong></div>
          <Stap1 />
          <div style={{ ...tekst, fontSize: 12, marginTop: 4 }}>Zie je het deel-icoon niet? Tik dan eerst op <strong>•••</strong> rechtsonder.</div>
          <div style={stapLabel}>2. Kies <strong>Zet op beginscherm</strong></div>
          <Stap2 />
          <div style={{ ...tekst, fontSize: 12, marginTop: 4 }}>Staat hij er niet tussen? Scroll het menu omlaag.</div>
          <div style={stapLabel}>3. Tik op <strong>Voeg toe</strong></div>
          <Stap3 />
          <div style={{ ...tekst, fontSize: 12, marginTop: 10 }}>
            Open daarna de app via het icoon op je beginscherm en log één keer in, daarna blijf je ingelogd.
          </div>
        </>
      ) : kanDirect ? (
        <button style={{ ...css.btn, opacity: bezig ? 0.6 : 1 }} disabled={bezig} onClick={startInstallatie}>
          {bezig ? "Even geduld…" : "📲 Installeer de app"}
        </button>
      ) : p.os === "android" ? (
        <div style={tekst}>
          {p.samsung
            ? <>Tik op het menu <strong>☰</strong> rechtsonder en kies <strong>Pagina toevoegen aan</strong> → <strong>Startscherm</strong>.</>
            : <>Tik op het menu <strong>⋮</strong> rechtsboven in je browser en kies <strong>App installeren</strong> of <strong>Toevoegen aan startscherm</strong>.</>}
        </div>
      ) : (
        <div style={tekst}>
          Op een computer: klik in de adresbalk van Chrome of Edge op het installatie-icoon, of open het browsermenu en kies <strong>App installeren</strong>.
        </div>
      )}
      {melding && <div style={{ ...tekst, color: T.text, marginTop: 10 }}>{melding}</div>}
    </div>
  );
}
