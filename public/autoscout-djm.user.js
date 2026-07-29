// ==UserScript==
// @name         De Jonge Motoren — AutoScout invuller
// @namespace    https://dejongemotoren.nl/
// @version      1.0.0
// @description  Vult het AutoScout24-advertentieformulier voor met de motorgegevens uit de DJM-app. Jij controleert en publiceert.
// @match        https://myarea.autoscout24.nl/*
// @match        https://www.autoscout24.nl/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

/*
  Werking
  -------
  1. In de DJM-app druk je bij een motor op "Autoscout24.nl ↗". Die knop opent
     AutoScout met de gegevens meegegeven in de URL (#djm=...).
  2. Dit script leest die gegevens één keer uit de URL en onthoudt ze (ook als
     AutoScout je naar een ander (sub)domein stuurt tijdens de wizard).
  3. Er verschijnt rechtsonder een paneel met alle gegevens: per veld een
     "kopieer"-knop, een "download alle foto's"-knop, en een knop die de
     zichtbare tekstvelden (kenteken, km, prijs, beschrijving) alvast probeert
     in te vullen. Keuzelijsten (kleur, type, uitrusting) kies je zelf — die
     staan met kopieerknoppen klaar. Daarna controleer je en klik je op
     "Plaats advertentie".

  Waarom niet 100% automatisch? AutoScout is een dynamisch formulier dat
  regelmatig verandert; keuzelijsten en foto-uploads zijn niet betrouwbaar
  vanuit een script te bedienen. Dit paneel maakt het handmatige deel zo kort
  mogelijk zonder te breken als AutoScout iets aanpast.
*/

(function () {
  "use strict";

  // ── Gegevens ophalen: eerst uit de URL-hash, anders uit de opslag ──────────
  const leesHash = () => {
    const m = (location.hash || "").match(/djm=([^&]+)/);
    if (!m) return null;
    try {
      const json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
      return JSON.parse(json);
    } catch (e) { return null; }
  };

  const uitHash = leesHash();
  if (uitHash) {
    GM_setValue("djm_motor", JSON.stringify(uitHash));
    GM_setValue("djm_ts", Date.now());
    // Hash opschonen zodat hij niet in de weg zit / meegedeeld wordt
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }

  const opgeslagen = (() => {
    try { return JSON.parse(GM_getValue("djm_motor", "null")); } catch (e) { return null; }
  })();
  const data = uitHash || opgeslagen;
  if (!data) return; // niets klaargezet → geen paneel

  // ── Hulpjes ────────────────────────────────────────────────────────────────
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "style") n.style.cssText = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    kids.forEach((c) => n.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return n;
  };

  const kopieer = (txt) => { try { navigator.clipboard.writeText(txt); } catch (e) {} };

  // React-compatibel een waarde in een input/textarea zetten.
  const zetWaarde = (node, waarde) => {
    if (!node) return false;
    const proto = node.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(node, waarde);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };

  // Zoek een tekstveld op naam/placeholder/aria-label/label-tekst.
  const vindVeld = (termen) => {
    const velden = [...document.querySelectorAll("input[type=text], input:not([type]), input[type=number], input[type=tel], textarea")];
    const norm = (s) => (s || "").toLowerCase();
    for (const t of termen) {
      const v = velden.find((f) => {
        const hay = [f.name, f.id, f.placeholder, f.getAttribute("aria-label")].map(norm).join(" ");
        let labelTxt = "";
        if (f.id) { const l = document.querySelector(`label[for="${f.id}"]`); if (l) labelTxt = norm(l.textContent); }
        return hay.includes(t) || labelTxt.includes(t);
      });
      if (v) return v;
    }
    return null;
  };

  const vulTekstvelden = () => {
    let n = 0;
    const k = vindVeld(["kenteken", "registration", "licence", "license"]);
    if (k && data.kenteken) n += zetWaarde(k, data.kenteken) ? 1 : 0;
    const km = vindVeld(["kilometer", "mileage", "km-stand", "tellerstand"]);
    if (km && data.km !== "") n += zetWaarde(km, data.km) ? 1 : 0;
    const prijs = vindVeld(["prijs", "price", "vraagprijs"]);
    if (prijs && data.prijs !== "") n += zetWaarde(prijs, data.prijs) ? 1 : 0;
    const oms = vindVeld(["beschrijving", "omschrijving", "description", "bijzonderheden"]);
    if (oms && data.beschrijving) n += zetWaarde(oms, data.beschrijving) ? 1 : 0;
    melding(n ? `${n} veld(en) ingevuld — controleer aub` : "Geen invulbare tekstvelden op deze stap gevonden");
  };

  // Foto's downloaden via Cloudinary fl_attachment (forceert een download).
  const downloadFotos = () => {
    (data.fotos || []).forEach((url, i) => {
      const dl = url.replace("/upload/", "/upload/fl_attachment/");
      setTimeout(() => {
        const a = el("a", { href: dl, download: "" });
        document.body.appendChild(a); a.click(); a.remove();
      }, i * 400); // spreiden zodat de browser ze niet blokkeert
    });
    melding(`${(data.fotos || []).length} foto('s) downloaden — sleep ze daarna in de uploader`);
  };

  // ── Paneel ───────────────────────────────────────────────────────────────
  let meldknop;
  const melding = (t) => { if (meldknop) meldknop.textContent = t; };

  const rij = (label, waarde) => {
    if (waarde === "" || waarde == null || (Array.isArray(waarde) && !waarde.length)) return null;
    const tekst = Array.isArray(waarde) ? waarde.join(", ") : String(waarde);
    return el("div", { style: "display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-bottom:1px solid #eee" },
      el("div", { style: "flex:1;min-width:0" },
        el("div", { style: "font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px" }, label),
        el("div", { style: "font-size:13px;color:#111;word-break:break-word" }, tekst)
      ),
      el("button", {
        style: "flex-shrink:0;font-size:11px;padding:3px 8px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer",
        onclick: () => kopieer(tekst),
      }, "kopieer")
    );
  };

  const bouwPaneel = () => {
    if (document.getElementById("djm-paneel")) return;
    const paneel = el("div", {
      id: "djm-paneel",
      style: "position:fixed;right:16px;bottom:16px;width:320px;max-height:80vh;overflow:auto;background:#fff;border:1px solid #ccc;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.25);z-index:2147483647;font-family:system-ui,sans-serif;padding:14px",
    });

    paneel.appendChild(el("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px" },
      el("div", { style: "font-weight:700;font-size:14px;color:#f50c30" }, "DJM → AutoScout"),
      el("button", { style: "border:none;background:none;font-size:18px;cursor:pointer;color:#888;line-height:1", onclick: () => paneel.remove() }, "×")
    ));

    [
      ["Kenteken", data.kenteken], ["Merk", data.merk], ["Model", data.model],
      ["Uitvoering", data.uitvoering], ["Carrosserietype", data.carrosserietype],
      ["Kleur", data.kleur], ["Bouwjaar", data.bouwjaar],
      ["Kilometerstand", data.km !== "" ? data.km + " km" : ""],
      ["Prijs", data.prijs !== "" ? "€ " + data.prijs : ""],
      ["Uitrusting", data.uitrusting], ["Beschrijving", data.beschrijving],
    ].forEach(([l, v]) => { const r = rij(l, v); if (r) paneel.appendChild(r); });

    if ((data.fotos || []).length) {
      paneel.appendChild(el("div", { style: "font-size:10px;color:#888;text-transform:uppercase;margin-top:8px" }, `Foto's (${data.fotos.length})`));
    }

    const knop = (txt, kleur, fn) => el("button", {
      style: `width:100%;margin-top:8px;padding:9px;border:none;border-radius:6px;background:${kleur};color:#fff;font-size:13px;font-weight:600;cursor:pointer`,
      onclick: fn,
    }, txt);

    paneel.appendChild(knop("Vul tekstvelden in (deze stap)", "#111", vulTekstvelden));
    if ((data.fotos || []).length) paneel.appendChild(knop("Download alle foto's", "#2563eb", downloadFotos));

    meldknop = el("div", { style: "margin-top:10px;font-size:11px;color:#555;min-height:14px" }, "Klaar. Loop de stappen langs; keuzelijsten kies je zelf.");
    paneel.appendChild(meldknop);

    document.body.appendChild(paneel);
  };

  // Het formulier is een SPA — paneel plaatsen en bij navigatie herstellen.
  bouwPaneel();
  setInterval(() => { if (!document.getElementById("djm-paneel")) bouwPaneel(); }, 1500);
})();
