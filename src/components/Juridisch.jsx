import { useState } from "react";

// ── Juridische documenten: privacybeleid, algemene voorwaarden, cookiemelding ──
// Versienummers: verhoog bij inhoudelijke wijziging zodat opnieuw akkoord gevraagd kan worden.
export const PRIVACY_VERSIE = "2026-07";
export const VOORWAARDEN_VERSIE = "2026-07";

const BEDRIJF = {
  naam: "De Jonge Motoren",
  adres: "Stevinweg 14, Tholen",
  email: "info@dejongemotor.nl",
};

// Basis-styling (thema-kleuren via prop T, zodat het werkt in login én app)
const stijl = (T) => ({
  h2: { fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 20, color: T.text, margin: "22px 0 8px" },
  p: { fontSize: 13, color: T.text, lineHeight: 1.75, margin: "0 0 10px" },
  li: { fontSize: 13, color: T.text, lineHeight: 1.75, marginBottom: 4 },
  muted: { fontSize: 12, color: T.muted, lineHeight: 1.7 },
});

export function PrivacyBeleid({ T }) {
  const s = stijl(T);
  return (
    <div>
      <div style={s.muted}>Versie {PRIVACY_VERSIE} · {BEDRIJF.naam}, {BEDRIJF.adres}</div>

      <h2 style={s.h2}>1. Wie zijn wij?</h2>
      <p style={s.p}>
        {BEDRIJF.naam}, gevestigd aan {BEDRIJF.adres}, is verantwoordelijk voor de verwerking van
        persoonsgegevens zoals beschreven in dit privacybeleid. Voor vragen over privacy kun je
        contact opnemen via <strong>{BEDRIJF.email}</strong>.
      </p>

      <h2 style={s.h2}>2. Welke gegevens verwerken wij?</h2>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li style={s.li}><strong>Contactgegevens:</strong> naam, adres, postcode, woonplaats, telefoonnummer, e-mailadres.</li>
        <li style={s.li}><strong>Accountgegevens:</strong> e-mailadres en wachtwoord (versleuteld opgeslagen), inloggeschiedenis.</li>
        <li style={s.li}><strong>Voertuiggegevens:</strong> kenteken, merk, model, bouwjaar, kilometerstanden, bandengegevens, servicehistorie en bijzonderheden van jouw motor(en).</li>
        <li style={s.li}><strong>Afspraakgegevens:</strong> gevraagde en geplande afspraken, soort werkzaamheden en opmerkingen die je zelf invult.</li>
        <li style={s.li}><strong>Foto's:</strong> alleen als je die zelf meestuurt (bijvoorbeeld bij een schademelding).</li>
      </ul>

      <h2 style={s.h2}>3. Waarvoor gebruiken wij deze gegevens?</h2>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li style={s.li}>Het uitvoeren van onze dienstverlening: onderhoud, reparatie, verkoop, consignatie, winterstalling en aanverwante diensten (<em>uitvoering van de overeenkomst</em>).</li>
        <li style={s.li}>Het inplannen en bevestigen van afspraken en het bijhouden van de servicehistorie van jouw motor (<em>uitvoering van de overeenkomst / gerechtvaardigd belang</em>).</li>
        <li style={s.li}>Contact met je opnemen over jouw motor, afspraak of aanvraag (<em>gerechtvaardigd belang</em>).</li>
        <li style={s.li}>Het voeren van onze administratie, waaronder wettelijke (fiscale) verplichtingen (<em>wettelijke plicht</em>).</li>
      </ul>
      <p style={{ ...s.p, marginTop: 10 }}>
        Wij gebruiken je gegevens <strong>niet</strong> voor geautomatiseerde besluitvorming, profilering
        of ongevraagde marketing, en wij verkopen je gegevens nooit aan derden.
      </p>

      <h2 style={s.h2}>4. Hoe lang bewaren wij gegevens?</h2>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li style={s.li}>Account- en profielgegevens: zolang je een account hebt.</li>
        <li style={s.li}>Werkplaats- en servicehistorie: zolang de klantrelatie duurt; gegevens die onderdeel zijn van onze administratie bewaren wij conform de wettelijke fiscale bewaarplicht (7 jaar).</li>
        <li style={s.li}>Foto's bij aanvragen: tot de aanvraag is afgehandeld en daarna maximaal 30 dagen.</li>
      </ul>

      <h2 style={s.h2}>5. Met wie delen wij gegevens?</h2>
      <p style={s.p}>
        Wij delen je gegevens alleen met partijen die nodig zijn om deze app en onze dienstverlening
        te laten werken (verwerkers), onder een verwerkersovereenkomst:
      </p>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li style={s.li}><strong>Supabase</strong> — beveiligde database en inlogsysteem van deze app.</li>
        <li style={s.li}><strong>Cloudinary</strong> — opslag van foto's die je zelf uploadt.</li>
        <li style={s.li}><strong>Cloudflare</strong> — hosting van deze app.</li>
      </ul>
      <p style={{ ...s.p, marginTop: 10 }}>
        Bij het opzoeken van voertuiggegevens via het kenteken raadplegen wij de openbare
        RDW-databank; daarbij wordt alleen het kenteken verstuurd. Buiten deze partijen verstrekken
        wij je gegevens alleen als de wet ons daartoe verplicht.
      </p>

      <h2 style={s.h2}>6. Cookies en lokale opslag</h2>
      <p style={s.p}>
        Deze app gebruikt <strong>alleen functionele</strong> cookies en lokale opslag: om je in te
        loggen en ingelogd te houden, en om voorkeuren te onthouden (zoals je thema en gekozen
        motor). Er zijn geen tracking-, advertentie- of analysecookies. Voor functionele opslag is
        geen toestemming vereist; we melden het wel bij je eerste bezoek.
      </p>

      <h2 style={s.h2}>7. Beveiliging</h2>
      <p style={s.p}>
        Je gegevens worden versleuteld verzonden (HTTPS) en opgeslagen bij gecertificeerde
        verwerkers. Toegang tot gegevens is beperkt: jij ziet alleen je eigen gegevens en alleen
        {" "}{BEDRIJF.naam} heeft toegang tot het klantenbestand. Wachtwoorden worden nooit leesbaar
        opgeslagen.
      </p>

      <h2 style={s.h2}>8. Jouw rechten</h2>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li style={s.li}><strong>Inzage en dataportabiliteit</strong> — via <em>Instellingen → Privacy &amp; gegevens → Download mijn gegevens</em> download je al je gegevens.</li>
        <li style={s.li}><strong>Rectificatie</strong> — je kunt je gegevens zelf aanpassen via Instellingen.</li>
        <li style={s.li}><strong>Verwijdering</strong> — via <em>Instellingen → Privacy &amp; gegevens → Account verwijderen</em> verwijder je zelf je account. Gegevens die onder de wettelijke bewaarplicht van onze administratie vallen, bewaren wij tot die termijn is verstreken.</li>
        <li style={s.li}><strong>Bezwaar en beperking</strong> — neem contact op via {BEDRIJF.email}.</li>
        <li style={s.li}><strong>Klacht</strong> — je hebt het recht een klacht in te dienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).</li>
      </ul>

      <h2 style={s.h2}>9. Wijzigingen</h2>
      <p style={s.p}>
        Wij kunnen dit beleid aanpassen. De actuele versie staat altijd in de app. Bij belangrijke
        wijzigingen informeren we je bij het inloggen.
      </p>
    </div>
  );
}

export function AlgemeneVoorwaarden({ T }) {
  const s = stijl(T);
  return (
    <div>
      <div style={s.muted}>Versie {VOORWAARDEN_VERSIE} · {BEDRIJF.naam}, {BEDRIJF.adres}</div>

      <h2 style={s.h2}>1. Toepasselijkheid</h2>
      <p style={s.p}>
        Deze voorwaarden gelden voor het gebruik van de app "Mijn Garage" van {BEDRIJF.naam} en op
        aanvragen die je via de app doet. Op werkzaamheden, reparaties en koop zijn daarnaast de
        afspraken van toepassing die we samen maken bij de opdracht of koop.
      </p>

      <h2 style={s.h2}>2. Je account</h2>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li style={s.li}>Een account is persoonlijk. Houd je wachtwoord geheim en geef je account niet aan anderen.</li>
        <li style={s.li}>Je bent zelf verantwoordelijk voor de juistheid van de gegevens die je invult (waaronder kilometerstanden en zelf ingevoerde werkzaamheden).</li>
        <li style={s.li}>Nieuwe accounts worden door ons gecontroleerd en geactiveerd. Wij mogen een account weigeren of blokkeren bij misbruik.</li>
        <li style={s.li}>Je kunt je account op elk moment zelf verwijderen via Instellingen.</li>
      </ul>

      <h2 style={s.h2}>3. Afspraken en aanvragen</h2>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li style={s.li}>Een aanvraag via de app (afspraak, proefrit, winterstalling, enz.) is een <strong>verzoek</strong> — de afspraak is pas definitief nadat wij deze hebben bevestigd.</li>
        <li style={s.li}>Verhinderd? Laat het ons zo vroeg mogelijk weten, dan plannen we kosteloos om.</li>
        <li style={s.li}>Voor een proefrit kunnen wij vragen om een geldig rijbewijs en een legitimatiebewijs.</li>
      </ul>

      <h2 style={s.h2}>4. Prijzen en tijdsindicaties</h2>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        <li style={s.li}>Tarieven en tijden in de app zijn <strong>indicatief</strong>. De werkelijke prijs en duur kunnen afwijken; bij meerwerk of afwijkingen nemen we eerst contact met je op.</li>
        <li style={s.li}>Bij werk in fases (grotere klussen) gaan we pas verder na jouw akkoord per fase.</li>
        <li style={s.li}>Prijzen van motoren en producten in de showroom zijn onder voorbehoud van tussenverkoop en kennelijke fouten.</li>
      </ul>

      <h2 style={s.h2}>5. Servicehistorie en eigen invoer</h2>
      <p style={s.p}>
        De servicehistorie in de app is een hulpmiddel. Werkzaamheden die je zelf invoert, worden
        gemarkeerd als eigen invoer en vallen buiten onze verantwoordelijkheid. Aan het
        onderhoudsinterval en andere indicaties in de app kunnen geen rechten worden ontleend.
      </p>

      <h2 style={s.h2}>6. Aansprakelijkheid app</h2>
      <p style={s.p}>
        Wij doen ons best de app beschikbaar en correct te houden, maar garanderen geen
        ononderbroken werking. Wij zijn niet aansprakelijk voor schade door onjuiste eigen invoer,
        storingen of het tijdelijk niet beschikbaar zijn van de app. Dit beperkt niet onze
        aansprakelijkheid voor uitgevoerde werkzaamheden volgens de wet.
      </p>

      <h2 style={s.h2}>7. Privacy</h2>
      <p style={s.p}>
        Op het gebruik van de app is ons privacybeleid van toepassing. Dat vind je in de app onder
        Instellingen en op het inlogscherm.
      </p>

      <h2 style={s.h2}>8. Wijzigingen en toepasselijk recht</h2>
      <p style={s.p}>
        Wij kunnen deze voorwaarden wijzigen; de actuele versie staat in de app. Op deze voorwaarden
        is Nederlands recht van toepassing. Vragen? Mail naar {BEDRIJF.email}.
      </p>
    </div>
  );
}

// ── Modal-wrapper voor juridische documenten ────────────────────────────────
export function JuridischModal({ type, T, onClose }) {
  if (!type) return null;
  const titel = type === "privacy" ? "PRIVACYBELEID" : "ALGEMENE VOORWAARDEN";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: T.surf, borderRadius: 10, maxWidth: 620, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Barlow, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 1, color: T.text }}>{titel}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "4px 20px 24px" }}>
          {type === "privacy" ? <PrivacyBeleid T={T} /> : <AlgemeneVoorwaarden T={T} />}
        </div>
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ width: "100%", padding: 12, background: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif" }}>
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cookiemelding bij eerste bezoek ─────────────────────────────────────────
// Alleen functionele cookies/lokale opslag → informeren volstaat (geen consent-muur nodig).
const COOKIE_KEY = "djm_cookie_melding_v1";

export function CookieBanner({ T, onToonPrivacy }) {
  const [gezien, setGezien] = useState(() => {
    try { return localStorage.getItem(COOKIE_KEY) === "1"; } catch { return true; }
  });
  if (gezien) return null;
  const sluit = () => {
    try { localStorage.setItem(COOKIE_KEY, "1"); } catch { /* private mode */ }
    setGezien(true);
  };
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 400, display: "flex", justifyContent: "center", padding: 12, pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", maxWidth: 560, width: "100%", background: T.surf, border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", padding: "14px 16px", fontFamily: "Barlow, sans-serif" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>🍪</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 3 }}>Cookies &amp; opslag</div>
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
              Deze app gebruikt alleen <strong style={{ color: T.text }}>functionele</strong> cookies en lokale opslag
              (inloggen &amp; voorkeuren). Geen tracking, geen advertenties.{" "}
              <span onClick={() => onToonPrivacy && onToonPrivacy()} style={{ color: T.accent, textDecoration: "underline", cursor: "pointer" }}>Privacybeleid</span>
            </div>
          </div>
        </div>
        <button onClick={sluit}
          style={{ width: "100%", marginTop: 12, padding: 10, background: T.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow, sans-serif" }}>
          Begrepen ✓
        </button>
      </div>
    </div>
  );
}
