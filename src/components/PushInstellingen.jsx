import { useState, useEffect } from "react";
import { pushOndersteund, moetEerstInstalleren, huidigAbonnement, zetPushAan, zetPushUit, stuurTestmelding } from "../lib/push.js";

// Admin → Instellingen: pushmeldingen op dit apparaat aan/uit + testmelding.
export default function PushInstellingen({ T, s }) {
  const [aan, setAan] = useState(null);       // null = nog aan het kijken
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);
  const [testUitkomst, setTestUitkomst] = useState(null);
  const ondersteund = pushOndersteund();
  const eerstInstalleren = moetEerstInstalleren();

  useEffect(() => {
    if (!ondersteund) { setAan(false); return; }
    huidigAbonnement().then((sub) => setAan(!!sub)).catch(() => setAan(false));
  }, [ondersteund]);

  const wissel = async () => {
    setBezig(true); setFout(null); setTestUitkomst(null);
    try {
      if (aan) { await zetPushUit(); setAan(false); }
      else { await zetPushAan(); setAan(true); }
    } catch (e) { setFout(e.message); }
    setBezig(false);
  };

  const test = async () => {
    setBezig(true); setFout(null); setTestUitkomst(null);
    try {
      const r = await stuurTestmelding();
      setTestUitkomst(r.verstuurd > 0
        ? `Testmelding verstuurd naar ${r.verstuurd} apparaat${r.verstuurd === 1 ? "" : "en"}. Komt hij niet binnen? Kijk of meldingen voor deze app aan staan.`
        : `Geen melding verstuurd${r.fouten?.length ? `: ${r.fouten[0]}` : " (geen aangemeld apparaat gevonden)"}.`);
    } catch (e) { setFout(e.message); }
    setBezig(false);
  };

  const uitleg = { fontSize: 12, color: T.muted, lineHeight: 1.6 };

  return (
    <div style={{ ...s.card, marginBottom: 16 }}>
      <div style={s.sectionLabel}>Pushmeldingen</div>
      <div style={{ ...uitleg, marginBottom: 12 }}>
        Een melding op dit apparaat bij een nieuwe afspraak of aanvraag (website en klantportaal), een nieuwe
        inkoop-aanvraag, nieuwe advertenties van de inkoop-radar, en klantacties in het portaal: nieuwe klant,
        motor toegevoegd, onderhoud ingevoerd of account verwijderd. Je eigen acties geven geen melding.
        Zet het aan op elk apparaat waarop je meldingen wilt krijgen.
      </div>

      {!ondersteund || eerstInstalleren ? (
        <div style={{ fontSize: 13, color: T.text, background: T.surf2, borderRadius: 6, padding: "10px 12px", lineHeight: 1.6 }}>
          {eerstInstalleren
            ? <>Op een iPhone werken meldingen alleen in de geïnstalleerde app. Open deze site in Safari → <strong>Delen</strong> → <strong>Zet op beginscherm</strong>, open de app via het icoon en zet meldingen hier aan.</>
            : "Deze browser ondersteunt geen pushmeldingen. Gebruik Chrome, Edge, Firefox of Safari (of de geïnstalleerde app)."}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: aan ? T.green : T.text }}>
              {aan === null ? "Even kijken…" : aan ? "✓ Aan op dit apparaat" : "Uit op dit apparaat"}
            </div>
            <button onClick={wissel} disabled={bezig || aan === null}
              style={{ ...(aan ? s.btnGhost : s.btn), opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig…" : aan ? "Zet uit" : "Zet aan"}
            </button>
          </div>
          {aan && (
            <button onClick={test} disabled={bezig} style={{ ...s.btnGhost, marginTop: 12, width: "100%" }}>
              Testmelding sturen
            </button>
          )}
        </>
      )}
      {testUitkomst && <div style={{ ...uitleg, color: T.text, marginTop: 10 }}>{testUitkomst}</div>}
      {fout && <div style={{ fontSize: 12, color: T.red, marginTop: 10 }}>⚠ {fout}</div>}
    </div>
  );
}
