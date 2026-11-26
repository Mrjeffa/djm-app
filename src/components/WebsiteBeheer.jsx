// "Website aanpassen": beheer van de inhoud van www.dejongemotoren.nl vanuit de app.
// Gestart vanuit Instellingen (alleen beheerder). Vaste velden per pagina, geen vrije
// paginabouwer: de admin past teksten en foto's aan, de website bepaalt de opmaak.
//
// Tabellen (zie supabase/website_cms.sql): website_blokken (+ _historie), website_faq,
// blog_posts, website_paginas (+ _historie). Lezen mag iedereen (de website), schrijven
// alleen de beheerder (RLS met is_admin()). Een wijziging staat direct live: de website
// leest bij elk bezoek de database.
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase as sb } from "../lib/supabase.js";
import { uploadAfbeelding } from "../lib/foto.js";
import {
  SITE_URL, SITE_HOST, PAGINAS, SEO_PADEN, SEO_ACHTERVOEGSEL, FAQ_GROEPEN, BLOG_CATEGORIEEN,
  VASTE_CODES, tariefCode, tariefTekst, vulCodesIn, tekstFouten, afbeeldingFouten, blokFouten,
  maakSlug, isSlug, isInternPad, isWebadres, telWoorden, lijktOp, voorbeeldUrl, datumTekst,
  datumTijdTekst, vandaagIso,
} from "../lib/website.js";

const ONOPGESLAGEN = "Je hebt wijzigingen die nog niet zijn opgeslagen. Toch weggaan?";
const OPGESLAGEN = "Opgeslagen. De wijziging staat direct op de website.";
const gelijk = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const LEGE_AFBEELDING = { url: "", alt: "", breedte: 0, hoogte: 0 };

// Supabase-fout in gewone taal
const foutTekst = (error) => {
  const m = `${error?.code || ""} ${error?.message || ""}`;
  if (/23505|duplicate/i.test(m)) return "Dit adres (slug) is al in gebruik. Kies een ander.";
  if (/check|violates/i.test(m)) return "De database weigert deze invoer: controleer lengtes en links.";
  if (/fetch|network|Failed to fetch/i.test(m)) return "Geen verbinding. Controleer je internet en probeer opnieuw.";
  if (/permission|rls|policy|42501/i.test(m)) return "Geen toegang: alleen de beheerder kan de website aanpassen.";
  return error?.message || "Onbekende fout";
};

// ── Kleine bouwstenen ────────────────────────────────────────────────────────
function Teller({ T, n, max, min }) {
  if (!max) return null;
  const kleur = n > max ? T.red : (min && n > 0 && n < min) ? T.yellow : T.muted;
  return <span style={{ fontSize: 11, color: kleur, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{n}/{max}{min ? ` (min. ${min})` : ""}</span>;
}

function Fouten({ T, lijst }) {
  if (!lijst?.length) return null;
  return (
    <div style={{ marginTop: 6 }}>
      {lijst.map((f, i) => <div key={i} style={{ fontSize: 12, color: T.red, lineHeight: 1.5 }}>⚠ {f}</div>)}
    </div>
  );
}

function Melding({ T, melding }) {
  if (!melding) return null;
  const kleur = melding.soort === "fout" ? T.red : melding.soort === "ok" ? T.green : T.muted;
  return <div role="status" style={{ fontSize: 13, color: kleur, lineHeight: 1.5 }}>{melding.tekst}</div>;
}

// Codes die de website invult; tikken = invoegen op de plek van de cursor
function CodesBalk({ T, tarieven = {}, onKies }) {
  const [tariefOpen, setTariefOpen] = useState(false);
  const houdFocus = (e) => e.preventDefault(); // tikken op een code mag het tekstveld niet laten verliezen
  const chip = { padding: "3px 8px", border: `1px solid ${T.border}`, borderRadius: 12, background: T.surf, color: T.text, fontSize: 12, cursor: "pointer", fontFamily: "Barlow, sans-serif" };
  const sleutels = Object.keys(tarieven).sort();
  return (
    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: T.muted }}>Invoegen:</span>
      {VASTE_CODES.map((c) => (
        <button key={c.code} type="button" style={chip} onMouseDown={houdFocus} onPointerDown={houdFocus} onClick={() => onKies(c.code)} title={c.uitleg}>{c.code}</button>
      ))}
      {sleutels.length > 0 && (
        <button type="button" style={{ ...chip, color: T.accent }} onMouseDown={houdFocus} onPointerDown={houdFocus} onClick={() => setTariefOpen((o) => !o)}>
          tarief {tariefOpen ? "▴" : "▾"}
        </button>
      )}
      {tariefOpen && (
        <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sleutels.map((k) => (
            <button key={k} type="button" style={chip} onMouseDown={houdFocus} onPointerDown={houdFocus} onClick={() => onKies(tariefCode(k))}>
              {k.replace(/_/g, " ")} <span style={{ color: T.muted }}>({tariefTekst(tarieven[k])})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TekstVeld({ T, s, waarde, onChange, max, min, meerRegels = false, rijen = 4, codes = false, tarieven, placeholder, id, hulp }) {
  const ref = useRef(null);
  const [focus, setFocus] = useState(false);
  const t = waarde ?? "";
  const voegIn = (code) => {
    const el = ref.current;
    const start = el?.selectionStart ?? t.length, eind = el?.selectionEnd ?? t.length;
    onChange(t.slice(0, start) + code + t.slice(eind));
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + code.length, start + code.length); } });
  };
  const stijl = { ...s.input, fontSize: 16, borderColor: max && t.length > max ? T.red : T.border, ...(meerRegels ? { resize: "vertical", lineHeight: 1.5, minHeight: 44 } : {}) };
  return (
    <div>
      {meerRegels
        ? <textarea ref={ref} id={id} rows={rijen} style={stijl} value={t} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
        : <input ref={ref} id={id} style={stijl} value={t} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>{hulp}</span>
        <Teller T={T} n={t.length} max={max} min={min} />
      </div>
      {codes && focus && <CodesBalk T={T} tarieven={tarieven} onKies={voegIn} />}
    </div>
  );
}

function AfbeeldingVeld({ T, s, waarde, onChange, formaat, optioneel = false }) {
  const a = waarde && typeof waarde === "object" ? waarde : LEGE_AFBEELDING;
  const invoer = useRef(null);
  const [status, setStatus] = useState(null);
  const kies = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setStatus({ soort: "bezig", tekst: "Uploaden…" });
    try {
      const r = await uploadAfbeelding(f);
      onChange({ ...a, ...r });
      setStatus(r.breedte && r.breedte < 1200 ? { soort: "info", tekst: `Let op: deze foto is maar ${r.breedte} px breed. Groter oogt scherper.` } : null);
    } catch (err) {
      setStatus({ soort: "fout", tekst: err.message });
    }
  };
  return (
    <div>
      {a.url ? (
        <div style={{ background: T.surf2, border: `1px solid ${T.border}`, borderRadius: 6, padding: 8, textAlign: "center" }}>
          <img src={voorbeeldUrl(a.url, 700)} alt={a.alt || ""} style={{ maxWidth: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 4 }} />
          {a.breedte > 0 && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{a.breedte} × {a.hoogte} px</div>}
        </div>
      ) : (
        <div style={{ background: T.surf2, border: `1px dashed ${T.border}`, borderRadius: 6, padding: "28px 10px", textAlign: "center", color: T.muted, fontSize: 13 }}>
          {optioneel ? "Geen afbeelding (de website toont dan niets)" : "Nog geen afbeelding"}
        </div>
      )}
      {formaat && <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>Advies: {formaat}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input ref={invoer} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={kies} />
        <button type="button" style={s.btnOutline} disabled={status?.soort === "bezig"} onClick={() => invoer.current?.click()}>
          {status?.soort === "bezig" ? "Uploaden…" : a.url ? "Vervang afbeelding" : "Kies afbeelding"}
        </button>
        {optioneel && a.url && <button type="button" style={s.btnGhost} onClick={() => onChange({ ...LEGE_AFBEELDING })}>Verwijderen</button>}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>jpg, png of webp, maximaal 10 MB.</div>
      {status && status.soort !== "bezig" && <div style={{ fontSize: 12, marginTop: 4, color: status.soort === "fout" ? T.red : T.yellow }}>{status.tekst}</div>}
      {a.url && (
        <div style={{ marginTop: 10 }}>
          <label style={s.label}>Omschrijving (alt-tekst, voor Google en schermlezers)</label>
          <TekstVeld T={T} s={s} waarde={a.alt} onChange={(alt) => onChange({ ...a, alt })} max={125} min={10}
            placeholder="Bijv. Rode Honda CB650R in de showroom van De Jonge Motoren" />
        </div>
      )}
    </div>
  );
}

function LijstVeld({ T, s, waarde, onChange, opties = {}, tarieven }) {
  const items = Array.isArray(waarde) ? waarde : [];
  const velden = opties.velden || [];
  const zet = (i, naam, v) => onChange(items.map((it, j) => (j === i ? { ...it, [naam]: v } : it)));
  const verplaats = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const kopie = [...items];
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    onChange(kopie);
  };
  const kanErbij = !opties.max_items || items.length < opties.max_items;
  const kanWeg = !opties.min_items || items.length > opties.min_items;
  const pijl = { ...s.btnGhost, padding: "4px 9px", fontSize: 13 };
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: 12, marginBottom: 10, background: T.surf2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>#{i + 1}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={pijl} disabled={i === 0} onClick={() => verplaats(i, -1)} aria-label="Omhoog">↑</button>
              <button type="button" style={pijl} disabled={i === items.length - 1} onClick={() => verplaats(i, 1)} aria-label="Omlaag">↓</button>
              {kanWeg && <button type="button" style={{ ...pijl, color: T.red }} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Verwijderen">✕</button>}
            </div>
          </div>
          {velden.map((v) => (
            <div key={v.naam} style={{ marginBottom: 8 }}>
              <label style={s.label}>{v.label}</label>
              <TekstVeld T={T} s={s} waarde={item?.[v.naam] ?? ""} onChange={(x) => zet(i, v.naam, x)} max={v.max}
                meerRegels={(v.max || 0) > 60} rijen={3} codes tarieven={tarieven} />
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {kanErbij
          ? <button type="button" style={s.btnOutline} onClick={() => onChange([...items, Object.fromEntries(velden.map((v) => [v.naam, ""]))])}>+ Toevoegen</button>
          : <span />}
        <span style={{ fontSize: 11, color: T.muted }}>
          {opties.min_items === opties.max_items && opties.min_items ? `Precies ${opties.min_items} items` : `${opties.min_items || 0} tot ${opties.max_items || "∞"} items`}
        </span>
      </div>
    </div>
  );
}

// Voorbeeld zoals Google het toont
function GoogleVoorbeeld({ T, titel, omschrijving, pad, leegTitel = "(huidige titel van de pagina)", leegOmschrijving = "(huidige omschrijving van de pagina)" }) {
  const t = (titel || "").trim();
  const o = (omschrijving || "").trim();
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 14px", fontFamily: "Arial, sans-serif", marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "#202124" }}>{SITE_HOST}{pad && pad !== "/" ? ` › ${pad.replace(/^\//, "").split("/").join(" › ")}` : ""}</div>
      <div style={{ fontSize: 18, color: "#1a0dab", lineHeight: 1.3, margin: "3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {t ? t + SEO_ACHTERVOEGSEL : <span style={{ color: "#70757a", fontStyle: "italic" }}>{leegTitel}</span>}
      </div>
      <div style={{ fontSize: 13, color: "#4d5156", lineHeight: 1.5 }}>
        {o || <span style={{ color: "#70757a", fontStyle: "italic" }}>{leegOmschrijving}</span>}
      </div>
    </div>
  );
}

// ── Markdown (alleen de subset die de website kent) ──────────────────────────
function inline(tekst, sleutel = "x") {
  const delen = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]*)\]\(([^)\s]*)\)/g;
  let laatste = 0, m, i = 0;
  while ((m = re.exec(tekst))) {
    if (m.index > laatste) delen.push(tekst.slice(laatste, m.index));
    if (m[1] !== undefined) delen.push(<strong key={`${sleutel}-${i++}`}>{m[1]}</strong>);
    else {
      const url = m[3];
      const href = isInternPad(url) ? SITE_URL + url : isWebadres(url) ? url : null;
      delen.push(href
        ? <a key={`${sleutel}-${i++}`} href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#E31E24" }}>{m[2]}</a>
        : <span key={`${sleutel}-${i++}`} style={{ textDecoration: "underline wavy #DC2626" }}>{m[2]}</span>);
    }
    laatste = re.lastIndex;
  }
  if (laatste < tekst.length) delen.push(tekst.slice(laatste));
  return delen;
}

export function MarkdownVoorbeeld({ T, tekst, tarieven }) {
  const blokken = vulCodesIn(tekst, tarieven).replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div style={{ fontSize: 15, lineHeight: 1.65, color: T.text }}>
      {blokken.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i} style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, margin: "18px 0 6px" }}>{inline(b.slice(3), `h${i}`)}</h2>;
        const regels = b.split("\n");
        if (regels.every((r) => /^\s*-\s+/.test(r))) {
          return <ul key={i} style={{ margin: "8px 0", paddingLeft: 22 }}>{regels.map((r, j) => <li key={j}>{inline(r.replace(/^\s*-\s+/, ""), `l${i}-${j}`)}</li>)}</ul>;
        }
        return <p key={i} style={{ margin: "8px 0" }}>{regels.map((r, j) => <span key={j}>{j > 0 && <br />}{inline(r, `p${i}-${j}`)}</span>)}</p>;
      })}
      {blokken.length === 0 && <p style={{ color: T.muted }}>(nog geen inhoud)</p>}
    </div>
  );
}

function MarkdownVeld({ T, s, waarde, onChange, max = 60000, rijen = 14, tarieven }) {
  const ref = useRef(null);
  const [voorbeeld, setVoorbeeld] = useState(false);
  const t = waarde ?? "";
  const pas = (fn) => {
    const el = ref.current;
    const start = el?.selectionStart ?? t.length, eind = el?.selectionEnd ?? t.length;
    const { tekst, selStart, selEind } = fn(t, start, eind);
    onChange(tekst);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(selStart, selEind); } });
  };
  const regelBegin = (tx, p) => tx.lastIndexOf("\n", p - 1) + 1;
  const tussenkop = () => pas((tx, a) => {
    const b = regelBegin(tx, a);
    const al = tx.startsWith("## ", b);
    const nieuw = al ? tx.slice(0, b) + tx.slice(b + 3) : tx.slice(0, b) + "## " + tx.slice(b);
    const d = al ? -3 : 3;
    return { tekst: nieuw, selStart: a + d, selEind: a + d };
  });
  const vet = () => pas((tx, a, e) => {
    const sel = tx.slice(a, e) || "vette tekst";
    return { tekst: tx.slice(0, a) + `**${sel}**` + tx.slice(e), selStart: a + 2, selEind: a + 2 + sel.length };
  });
  const lijst = () => pas((tx, a, e) => {
    const b = regelBegin(tx, a);
    const regels = tx.slice(b, e).split("\n").map((r) => (r.startsWith("- ") ? r : "- " + r));
    const blok = regels.join("\n");
    return { tekst: tx.slice(0, b) + blok + tx.slice(e), selStart: b + blok.length, selEind: b + blok.length };
  });
  const link = () => pas((tx, a, e) => {
    const sel = tx.slice(a, e) || "linktekst";
    const invoeg = `[${sel}](/occasions)`;
    const urlStart = a + sel.length + 3;
    return { tekst: tx.slice(0, a) + invoeg + tx.slice(e), selStart: urlStart, selEind: urlStart + "/occasions".length };
  });
  const knop = { ...s.btnGhost, padding: "5px 10px", fontSize: 12 };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        <button type="button" style={knop} onClick={tussenkop} disabled={voorbeeld}>Tussenkop</button>
        <button type="button" style={{ ...knop, fontWeight: 700 }} onClick={vet} disabled={voorbeeld}>Vet</button>
        <button type="button" style={knop} onClick={lijst} disabled={voorbeeld}>• Lijst</button>
        <button type="button" style={knop} onClick={link} disabled={voorbeeld}>Link</button>
        <span style={{ flex: 1 }} />
        <button type="button" style={{ ...knop, color: voorbeeld ? T.accent : T.muted, borderColor: voorbeeld ? T.accent : T.border }} onClick={() => setVoorbeeld((v) => !v)}>
          {voorbeeld ? "Bewerken" : "Voorbeeld"}
        </button>
      </div>
      {voorbeeld ? (
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 14px", background: T.surf, minHeight: 120 }}>
          <MarkdownVoorbeeld T={T} tekst={t} tarieven={tarieven} />
        </div>
      ) : (
        <textarea ref={ref} rows={rijen} value={t} onChange={(e) => onChange(e.target.value)}
          style={{ ...s.input, fontSize: 15, lineHeight: 1.55, resize: "vertical", fontFamily: "ui-monospace, Menlo, Consolas, monospace" }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
        <span style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
          <b>## </b>tussenkop · lege regel = nieuwe alinea · <b>- </b>opsomming · <b>**vet**</b> · [tekst](/pad) of [tekst](https://…)
        </span>
        <Teller T={T} n={t.length} max={max} />
      </div>
    </div>
  );
}

// Onderbalk met Opslaan; blijft op de telefoon in beeld
function OpslaanBalk({ T, s, kanOpslaan, bezig, onOpslaan, melding, links, extra }) {
  return (
    <div style={{ position: "sticky", bottom: 0, zIndex: 5, background: T.surf, borderTop: `1px solid ${T.border}`, margin: "16px -4px 0", padding: "10px 4px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" style={{ ...s.btn, padding: "11px 22px", fontSize: 15, opacity: kanOpslaan && !bezig ? 1 : 0.45 }} disabled={!kanOpslaan || bezig} onClick={onOpslaan}>
        {bezig ? "Opslaan…" : "Opslaan"}
      </button>
      {extra}
      {links}
      <div style={{ flexBasis: "100%" }}><Melding T={T} melding={melding} /></div>
    </div>
  );
}

const BekijkLink = ({ s, pad, tekst = "Bekijk op website ↗" }) => (
  <a href={SITE_URL + pad} target="_blank" rel="noopener noreferrer" style={{ ...s.btnGhost, textDecoration: "none", display: "inline-block" }}>{tekst}</a>
);

// "Niet opgeslagen"-signaal naar boven + waarschuwing bij sluiten/verversen van het tabblad
function useOnopgeslagen(dirty, onDirty) {
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}

// ── Vorige versies van één veld ──────────────────────────────────────────────
const korteWeergave = (type, w) => {
  if (type === "afbeelding") return w?.url ? (w.alt || w.url) : "(geen afbeelding)";
  if (type === "lijst") return Array.isArray(w) ? `${w.length} items: ${w.map((i) => i.titel || i.label || i.tekst || "").filter(Boolean).join(" · ")}` : "";
  return typeof w === "string" ? (w.trim() || "(leeg)") : JSON.stringify(w);
};

function VeldVersies({ T, s, sleutel, type, onTerugzetten, onSluit }) {
  const [versies, setVersies] = useState(null);
  const [fout, setFout] = useState(null);
  useEffect(() => {
    let actief = true;
    sb.from("website_blokken_historie").select("id,waarde,gewijzigd_op").eq("sleutel", sleutel)
      .order("gewijzigd_op", { ascending: false }).limit(20)
      .then(({ data, error }) => { if (!actief) return; if (error) setFout(foutTekst(error)); else setVersies(data || []); });
    return () => { actief = false; };
  }, [sleutel]);
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: 10, marginTop: 8, background: T.surf2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Vorige versies</span>
        <button type="button" style={{ ...s.btnGhost, padding: "3px 9px", fontSize: 12 }} onClick={onSluit}>Sluiten</button>
      </div>
      {fout && <div style={{ fontSize: 12, color: T.red }}>{fout}</div>}
      {!versies && !fout && <div style={{ fontSize: 12, color: T.muted }}>Laden…</div>}
      {versies?.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>Nog geen eerdere versies: dit veld is nog niet gewijzigd.</div>}
      {versies?.map((v) => (
        <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", borderTop: `1px solid ${T.border}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: T.muted }}>{datumTijdTekst(v.gewijzigd_op)}</div>
            <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{korteWeergave(type, v.waarde)}</div>
          </div>
          <button type="button" style={{ ...s.btnOutline, padding: "4px 10px", fontSize: 12 }} onClick={() => onTerugzetten(v.waarde)}>Terugzetten</button>
        </div>
      ))}
      <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Terugzetten zet de tekst in het veld; daarna nog op Opslaan tikken.</div>
    </div>
  );
}

function VeldMenu({ T, s, onVersies, onStandaard }) {
  const [open, setOpen] = useState(false);
  const item = { display: "block", width: "100%", textAlign: "left", padding: "9px 12px", background: "none", border: "none", color: T.text, fontSize: 13, cursor: "pointer", fontFamily: "Barlow, sans-serif" };
  return (
    <div style={{ position: "relative" }}>
      <button type="button" aria-label="Meer opties" style={{ ...s.btnGhost, padding: "2px 9px", fontSize: 15, lineHeight: 1 }} onClick={() => setOpen((o) => !o)}>⋯</button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", right: 0, top: "110%", zIndex: 10, background: T.surf, border: `1px solid ${T.border}`, borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,0.15)", minWidth: 190 }}>
            <button type="button" style={item} onClick={() => { setOpen(false); onVersies(); }}>Vorige versies</button>
            <button type="button" style={item} onClick={() => { setOpen(false); onStandaard(); }}>Standaard herstellen</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Pagina-editor (website_blokken), ook voor de Google-teksten ──────────────
function BlokkenEditor({ T, s, pagina, naam, pad, tarieven, onDirty }) {
  const [rijen, setRijen] = useState(null);
  const [laadFout, setLaadFout] = useState(null);
  const [waarden, setWaarden] = useState({});
  const [opgeslagen, setOpgeslagen] = useState({});
  const [versiesVan, setVersiesVan] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null);
  const seo = pagina === "seo";

  useEffect(() => {
    let actief = true;
    sb.from("website_blokken").select("sleutel,pagina,sectie,label,type,waarde,standaard,opties,volgorde,bijgewerkt_op")
      .eq("pagina", pagina).order("volgorde").order("sleutel")
      .then(({ data, error }) => {
        if (!actief) return;
        if (error) { setLaadFout(foutTekst(error)); return; }
        const w = Object.fromEntries((data || []).map((r) => [r.sleutel, r.waarde]));
        setRijen(data || []); setWaarden(w); setOpgeslagen(w);
      });
    return () => { actief = false; };
  }, [pagina]);

  const gewijzigd = useMemo(() => (rijen || []).filter((r) => !gelijk(waarden[r.sleutel], opgeslagen[r.sleutel])).map((r) => r.sleutel), [rijen, waarden, opgeslagen]);
  const fouten = useMemo(() => {
    const f = {};
    for (const r of rijen || []) {
      const lijst = blokFouten(r, waarden[r.sleutel], tarieven);
      if (seo && /\.omschrijving$/.test(r.sleutel)) {
        const n = String(waarden[r.sleutel] ?? "").trim().length;
        if (n > 0 && n < 120) lijst.push(`Te kort voor Google: ${n} tekens, mik op 120 tot 160.`);
      }
      if (lijst.length) f[r.sleutel] = lijst;
    }
    return f;
  }, [rijen, waarden, tarieven, seo]);
  const foutInGewijzigd = gewijzigd.some((k) => fouten[k]);
  useOnopgeslagen(gewijzigd.length > 0, onDirty);

  // Secties in de volgorde van de pagina (eerste veld bepaalt de plek)
  const secties = useMemo(() => {
    const m = new Map();
    for (const r of rijen || []) { if (!m.has(r.sectie)) m.set(r.sectie, []); m.get(r.sectie).push(r); }
    return [...m.entries()];
  }, [rijen]);

  const zet = (k, v) => { setWaarden((p) => ({ ...p, [k]: v })); setMelding(null); };

  const opslaan = async () => {
    if (!gewijzigd.length || foutInGewijzigd) return;
    setBezig(true); setMelding(null);
    const mislukt = [];
    const nieuw = {};
    await Promise.all(gewijzigd.map(async (k) => {
      const { data, error } = await sb.from("website_blokken").update({ waarde: waarden[k] }).eq("sleutel", k).select("sleutel,waarde");
      if (error || !data?.length) mislukt.push({ k, fout: error ? foutTekst(error) : "Niet opgeslagen (geen toegang)." });
      else nieuw[k] = data[0].waarde;
    }));
    setOpgeslagen((p) => ({ ...p, ...nieuw }));
    setBezig(false);
    if (mislukt.length) {
      const label = (k) => rijen.find((r) => r.sleutel === k)?.label || k;
      setMelding({ soort: "fout", tekst: `Niet opgeslagen: ${mislukt.map((m) => `${label(m.k)} (${m.fout})`).join("; ")}` });
    } else setMelding({ soort: "ok", tekst: OPGESLAGEN });
  };

  if (laadFout) return <div style={{ ...s.card, color: T.red }}>Laden mislukt: {laadFout}</div>;
  if (!rijen) return <div style={{ color: T.muted, fontSize: 13 }}>Laden…</div>;
  if (!rijen.length) return <div style={{ ...s.card, color: T.muted }}>Geen velden gevonden voor deze pagina.</div>;

  const veld = (r) => {
    const o = r.opties || {};
    const w = waarden[r.sleutel];
    const veranderd = !gelijk(w, opgeslagen[r.sleutel]);
    return (
      <div key={r.sleutel} style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <label htmlFor={`v-${r.sleutel}`} style={{ ...s.label, marginBottom: 0 }}>
            {r.label}{veranderd && <span style={{ color: T.accent, textTransform: "none", letterSpacing: 0 }}> · gewijzigd</span>}
          </label>
          <VeldMenu T={T} s={s} onVersies={() => setVersiesVan(r.sleutel)} onStandaard={() => zet(r.sleutel, r.standaard)} />
        </div>
        {r.type === "tekst" && (
          <TekstVeld T={T} s={s} id={`v-${r.sleutel}`} waarde={w} onChange={(v) => zet(r.sleutel, v)} max={o.max}
            min={seo && /\.omschrijving$/.test(r.sleutel) ? 120 : undefined} codes={!seo} tarieven={tarieven}
            meerRegels={(o.max || 0) > 100} rijen={3}
            placeholder={seo ? "Leeg = de website gebruikt de huidige tekst" : (typeof r.standaard === "string" ? r.standaard : "")} />
        )}
        {r.type === "tekst_lang" && (
          <TekstVeld T={T} s={s} id={`v-${r.sleutel}`} waarde={w} onChange={(v) => zet(r.sleutel, v)} max={o.max} meerRegels
            rijen={Math.min(10, Math.max(3, Math.ceil((o.max || 300) / 120)))} codes tarieven={tarieven}
            hulp="Lege regel = nieuwe alinea · **vet** · [linktekst](/pad)" />
        )}
        {r.type === "afbeelding" && <AfbeeldingVeld T={T} s={s} waarde={w} onChange={(v) => zet(r.sleutel, v)} formaat={o.formaat} optioneel={!!o.optioneel} />}
        {r.type === "lijst" && <LijstVeld T={T} s={s} waarde={w} onChange={(v) => zet(r.sleutel, v)} opties={o} tarieven={tarieven} />}
        {o.hulp && <div style={{ fontSize: 11, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>{o.hulp}</div>}
        {seo && /\.titel$/.test(r.sleutel) && (
          <div style={{ fontSize: 11, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>
            Noem waar het over gaat en de plaats, bv. "Motor onderhoud en reparatie in Tholen". De website zet er "{SEO_ACHTERVOEGSEL.trim()}" achter.
          </div>
        )}
        <Fouten T={T} lijst={fouten[r.sleutel]} />
        {versiesVan === r.sleutel && (
          <VeldVersies T={T} s={s} sleutel={r.sleutel} type={r.type} onSluit={() => setVersiesVan(null)}
            onTerugzetten={(v) => { zet(r.sleutel, v); setVersiesVan(null); }} />
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>
        {seo
          ? "Zo verschijnt elke pagina in Google. Leeg laten mag: de website gebruikt dan de huidige titel en omschrijving."
          : "Pas de teksten en foto's van deze pagina aan. Een leeg tekstveld toont de standaardtekst op de website."}
      </div>
      {secties.map(([sectie, velden]) => {
        const id = seo ? velden[0].sleutel.split(".")[1] : null;
        return (
          <div key={sectie} style={{ ...s.card, marginBottom: 14 }}>
            <div style={s.sectionLabel}>{sectie}</div>
            {seo && (
              <GoogleVoorbeeld T={T} pad={SEO_PADEN[id]}
                titel={waarden[`seo.${id}.titel`]} omschrijving={waarden[`seo.${id}.omschrijving`]} />
            )}
            {velden.map(veld)}
          </div>
        );
      })}
      <OpslaanBalk T={T} s={s} bezig={bezig} onOpslaan={opslaan} melding={melding}
        kanOpslaan={gewijzigd.length > 0 && !foutInGewijzigd}
        extra={gewijzigd.length > 0 && <span style={{ fontSize: 12, color: foutInGewijzigd ? T.red : T.muted }}>{foutInGewijzigd ? "Los eerst de fouten op" : `${gewijzigd.length} gewijzigd`}</span>}
        links={pad && <BekijkLink s={s} pad={pad} />} />
    </div>
  );
}

// ── Veelgestelde vragen ──────────────────────────────────────────────────────
const faqFouten = (v, tarieven) => {
  const f = [];
  const vraag = (v.vraag || "").trim();
  if (vraag.length < 5 || vraag.length > 140) f.push("Vraag: 5 tot 140 tekens.");
  const antwoord = (v.antwoord || "").trim();
  if (antwoord.length < 20) f.push("Antwoord: minimaal 20 tekens.");
  f.push(...tekstFouten(v.antwoord, { tarieven, max: 900 }).map((x) => `Antwoord: ${x}`));
  f.push(...tekstFouten(v.vraag, { tarieven }).filter((x) => !/^Te /.test(x)).map((x) => `Vraag: ${x}`));
  const href = (v.link_href || "").trim(), label = (v.link_label || "").trim();
  if (href && !isInternPad(href)) f.push("Link: alleen een pad op de eigen website, zoals /werkplaats.");
  if (href && !label) f.push("Link: vul ook de knoptekst in.");
  if (label && !href) f.push("Link: vul ook het pad in, of maak de knoptekst leeg.");
  if (label.length > 40) f.push("Knoptekst: maximaal 40 tekens.");
  return f;
};

function FaqItem({ T, s, item, opgeslagen, open, onOpen, onChange, onOpslaan, onVerwijder, onOmhoog, onOmlaag, eerste, laatste, tarieven, bezig }) {
  const [bevestig, setBevestig] = useState(false);
  const fouten = faqFouten(item, tarieven);
  const veranderd = !opgeslagen || !gelijk(
    { v: item.vraag, a: item.antwoord, h: item.link_href || "", l: item.link_label || "", x: item.actief },
    { v: opgeslagen.vraag, a: opgeslagen.antwoord, h: opgeslagen.link_href || "", l: opgeslagen.link_label || "", x: opgeslagen.actief });
  const pijl = { ...s.btnGhost, padding: "4px 9px", fontSize: 13 };
  return (
    <div style={{ ...s.card, padding: 14, marginBottom: 10, borderColor: veranderd ? T.accent : T.border }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <button type="button" onClick={onOpen} style={{ flex: 1, textAlign: "left", background: "none", border: "none", padding: 0, color: T.text, cursor: "pointer", fontFamily: "Barlow, sans-serif" }}>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{item.vraag || <span style={{ color: T.muted }}>(nieuwe vraag)</span>}</div>
          <div style={{ fontSize: 11, marginTop: 3, color: T.muted }}>
            {!item.actief && <span style={{ ...s.badge(T.muted), marginRight: 6 }}>Verborgen</span>}
            {!opgeslagen && <span style={{ ...s.badge(T.yellow), marginRight: 6 }}>Nieuw</span>}
            {veranderd && opgeslagen && <span style={{ ...s.badge(T.accent), marginRight: 6 }}>Niet opgeslagen</span>}
            {open ? "▴ inklappen" : "▾ bewerken"}
          </div>
        </button>
        {opgeslagen && (
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" style={pijl} disabled={eerste || bezig} onClick={onOmhoog} aria-label="Omhoog">↑</button>
            <button type="button" style={pijl} disabled={laatste || bezig} onClick={onOmlaag} aria-label="Omlaag">↓</button>
          </div>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <label style={s.label}>Vraag</label>
          <TekstVeld T={T} s={s} waarde={item.vraag} onChange={(v) => onChange({ vraag: v })} max={140} min={5} />
          <label style={{ ...s.label, marginTop: 10 }}>Antwoord</label>
          <TekstVeld T={T} s={s} waarde={item.antwoord} onChange={(v) => onChange({ antwoord: v })} max={900} min={20} meerRegels rijen={6} codes tarieven={tarieven}
            hulp="Begin met het directe antwoord, noem De Jonge Motoren bij naam, 40–100 woorden." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 10 }}>
            <div>
              <label style={s.label}>Link naar pagina (optioneel)</label>
              <input style={{ ...s.input, fontSize: 16 }} value={item.link_href || ""} placeholder="/werkplaats" onChange={(e) => onChange({ link_href: e.target.value })} />
            </div>
            <div>
              <label style={s.label}>Knoptekst</label>
              <input style={{ ...s.input, fontSize: 16 }} value={item.link_label || ""} placeholder="Onderhoud aanvragen" maxLength={60} onChange={(e) => onChange({ link_label: e.target.value })} />
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 14, cursor: "pointer" }}>
            <input type="checkbox" checked={!!item.actief} onChange={(e) => onChange({ actief: e.target.checked })} style={{ width: 18, height: 18 }} />
            Tonen op de website
          </label>
          <Fouten T={T} lijst={fouten} />
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={{ ...s.btn, opacity: veranderd && !fouten.length && !bezig ? 1 : 0.45 }} disabled={!veranderd || fouten.length > 0 || bezig} onClick={onOpslaan}>
              {bezig ? "Opslaan…" : opgeslagen ? "Opslaan" : "Vraag toevoegen"}
            </button>
            {bevestig ? (
              <>
                <span style={{ fontSize: 13 }}>Deze vraag verwijderen?</span>
                <button type="button" style={{ ...s.btn, background: T.red }} onClick={() => { setBevestig(false); onVerwijder(); }}>Ja, verwijderen</button>
                <button type="button" style={s.btnGhost} onClick={() => setBevestig(false)}>Annuleer</button>
              </>
            ) : (
              <button type="button" style={{ ...s.btnGhost, color: T.red }} onClick={() => (opgeslagen ? setBevestig(true) : onVerwijder())}>{opgeslagen ? "Verwijderen" : "Weggooien"}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FaqBeheer({ T, s, tarieven, onDirty }) {
  const [items, setItems] = useState(null);
  const [opgeslagen, setOpgeslagen] = useState({});
  const [groep, setGroep] = useState("kopen");
  const [open, setOpen] = useState(null);
  const [bezigId, setBezigId] = useState(null);
  const [melding, setMelding] = useState(null);
  const tijdelijk = useRef(0);

  useEffect(() => {
    sb.from("website_faq").select("id,groep,vraag,antwoord,link_href,link_label,volgorde,actief,bijgewerkt_op")
      .order("groep").order("volgorde").then(({ data, error }) => {
        if (error) { setMelding({ soort: "fout", tekst: `Laden mislukt: ${foutTekst(error)}` }); setItems([]); return; }
        setItems(data || []);
        setOpgeslagen(Object.fromEntries((data || []).map((r) => [r.id, r])));
      });
  }, []);

  const dirty = (items || []).some((i) => !opgeslagen[i.id] || !gelijk(
    [i.vraag, i.antwoord, i.link_href || "", i.link_label || "", i.actief],
    [opgeslagen[i.id].vraag, opgeslagen[i.id].antwoord, opgeslagen[i.id].link_href || "", opgeslagen[i.id].link_label || "", opgeslagen[i.id].actief]));
  useOnopgeslagen(dirty, onDirty);

  if (!items) return <div style={{ color: T.muted, fontSize: 13 }}>Laden…</div>;
  const inGroep = items.filter((i) => i.groep === groep).sort((a, b) => a.volgorde - b.volgorde);
  const zet = (id, d) => { setItems((p) => p.map((i) => (i.id === id ? { ...i, ...d } : i))); setMelding(null); };

  const voegToe = () => {
    const id = `nieuw-${++tijdelijk.current}`;
    const volgorde = inGroep.reduce((m, i) => Math.max(m, i.volgorde), 0) + 1;
    setItems((p) => [...p, { id, groep, vraag: "", antwoord: "", link_href: "", link_label: "", actief: true, volgorde }]);
    setOpen(id);
  };

  const opslaan = async (item) => {
    setBezigId(item.id); setMelding(null);
    const rij = {
      groep: item.groep, vraag: item.vraag.trim(), antwoord: item.antwoord.trim(),
      link_href: (item.link_href || "").trim() || null, link_label: (item.link_label || "").trim() || null,
      actief: !!item.actief, volgorde: item.volgorde,
    };
    const nieuw = !opgeslagen[item.id];
    const { data, error } = nieuw
      ? await sb.from("website_faq").insert(rij).select().single()
      : await sb.from("website_faq").update(rij).eq("id", item.id).select().single();
    setBezigId(null);
    if (error || !data) { setMelding({ soort: "fout", tekst: `Niet opgeslagen: ${foutTekst(error)}` }); return; }
    setItems((p) => p.map((i) => (i.id === item.id ? data : i)));
    setOpgeslagen((p) => { const n = { ...p, [data.id]: data }; if (nieuw) delete n[item.id]; return n; });
    if (open === item.id) setOpen(data.id);
    setMelding({ soort: "ok", tekst: OPGESLAGEN });
  };

  const verwijder = async (item) => {
    if (!opgeslagen[item.id]) { setItems((p) => p.filter((i) => i.id !== item.id)); return; }
    setBezigId(item.id);
    const { error } = await sb.from("website_faq").delete().eq("id", item.id);
    setBezigId(null);
    if (error) { setMelding({ soort: "fout", tekst: `Verwijderen mislukt: ${foutTekst(error)}` }); return; }
    setItems((p) => p.filter((i) => i.id !== item.id));
    setOpgeslagen((p) => { const n = { ...p }; delete n[item.id]; return n; });
    setMelding({ soort: "ok", tekst: "Verwijderd. De vraag staat niet meer op de website." });
  };

  // Volgorde wisselen met de buurvraag (alleen opgeslagen vragen)
  const verplaats = async (item, d) => {
    const lijst = inGroep.filter((i) => opgeslagen[i.id]);
    const idx = lijst.findIndex((i) => i.id === item.id);
    if (!lijst[idx + d]) return;
    const nieuw = [...lijst];
    [nieuw[idx], nieuw[idx + d]] = [nieuw[idx + d], nieuw[idx]];
    // 1, 2, 3, … opnieuw nummeren; alleen wat verandert opslaan
    const wijzig = nieuw.map((x, n) => ({ id: x.id, volgorde: n + 1 })).filter((x) => opgeslagen[x.id].volgorde !== x.volgorde);
    setBezigId(item.id);
    const res = await Promise.all(wijzig.map((x) => sb.from("website_faq").update({ volgorde: x.volgorde }).eq("id", x.id).select("id,volgorde").single()));
    setBezigId(null);
    if (res.some((r) => r.error || !r.data)) { setMelding({ soort: "fout", tekst: "Volgorde opslaan mislukt." }); return; }
    const vol = Object.fromEntries(res.map((r) => [r.data.id, r.data.volgorde]));
    setItems((p) => p.map((i) => (i.id in vol ? { ...i, volgorde: vol[i.id] } : i)));
    setOpgeslagen((p) => { const n = { ...p }; for (const id in vol) n[id] = { ...n[id], volgorde: vol[id] }; return n; });
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 12, lineHeight: 1.6 }}>
        De vragen staan op <b>/veelgestelde-vragen</b> en bij de bijbehorende pagina's. De vraag over openingstijden maakt de website zelf uit de openingstijden.
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {FAQ_GROEPEN.map((g) => {
          const n = items.filter((i) => i.groep === g.id).length;
          const actief = groep === g.id;
          return (
            <button key={g.id} type="button" onClick={() => { setGroep(g.id); setOpen(null); }}
              style={{ ...s.btnGhost, background: actief ? `${T.accent}15` : "transparent", color: actief ? T.accent : T.muted, borderColor: actief ? T.accent : T.border, fontWeight: actief ? 600 : 400 }}>
              {g.naam} ({n})
            </button>
          );
        })}
      </div>
      {inGroep.map((item, i) => (
        <FaqItem key={item.id} T={T} s={s} item={item} opgeslagen={opgeslagen[item.id]} tarieven={tarieven}
          open={open === item.id} onOpen={() => setOpen(open === item.id ? null : item.id)}
          onChange={(d) => zet(item.id, d)} onOpslaan={() => opslaan(item)} onVerwijder={() => verwijder(item)}
          onOmhoog={() => verplaats(item, -1)} onOmlaag={() => verplaats(item, 1)}
          eerste={i === 0} laatste={i === inGroep.length - 1} bezig={bezigId === item.id} />
      ))}
      {inGroep.length === 0 && <div style={{ ...s.card, color: T.muted, fontSize: 13, marginBottom: 10 }}>Nog geen vragen in deze groep.</div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <button type="button" style={s.btnOutline} onClick={voegToe}>+ Vraag toevoegen</button>
        <BekijkLink s={s} pad="/veelgestelde-vragen" />
      </div>
      <div style={{ marginTop: 10 }}><Melding T={T} melding={melding} /></div>
    </div>
  );
}

// ── Blog ─────────────────────────────────────────────────────────────────────
function BlogLijst({ T, s, onOpen }) {
  const [posts, setPosts] = useState(null);
  const [fout, setFout] = useState(null);
  useEffect(() => {
    sb.from("blog_posts").select("id,titel,slug,status,gepubliceerd_op,bijgewerkt_op").order("bijgewerkt_op", { ascending: false })
      .then(({ data, error }) => { if (error) setFout(foutTekst(error)); setPosts(data || []); });
  }, []);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: T.muted }}>Artikelen op <b>/blog</b>. Een concept is nog niet zichtbaar.</div>
        <button type="button" style={s.btn} onClick={() => onOpen(null)}>+ Nieuw artikel</button>
      </div>
      {fout && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>Laden mislukt: {fout}</div>}
      {!posts && <div style={{ color: T.muted, fontSize: 13 }}>Laden…</div>}
      {posts?.length === 0 && (
        <div style={{ ...s.card, color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
          Nog geen artikelen in de app. De vier artikelen die nu op de website staan, worden bij het koppelen van de website overgezet en verschijnen dan hier.
        </div>
      )}
      {posts?.map((p) => (
        <button key={p.id} type="button" onClick={() => onOpen(p.id)}
          style={{ ...s.card, display: "block", width: "100%", textAlign: "left", marginBottom: 8, cursor: "pointer", color: T.text, fontFamily: "Barlow, sans-serif", padding: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{p.titel}</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={s.badge(p.status === "gepubliceerd" ? T.green : T.yellow)}>{p.status === "gepubliceerd" ? "Gepubliceerd" : "Concept"}</span>
            {p.gepubliceerd_op && <span>{datumTekst(p.gepubliceerd_op)}</span>}
            <span>· gewijzigd {datumTekst(p.bijgewerkt_op)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

const blogFouten = (f) => {
  const fout = [];
  const t = f.titel.trim(), b = f.beschrijving.trim(), c = f.categorie.trim();
  if (t.length < 10 || t.length > 90) fout.push("Titel: 10 tot 90 tekens.");
  if (b.length < 70 || b.length > 170) fout.push(`Korte beschrijving: 70 tot 170 tekens (nu ${b.length}).`);
  if (c.length < 2 || c.length > 40) fout.push("Kies of typ een categorie.");
  if (!isSlug(f.slug)) fout.push("Adres (slug): alleen kleine letters, cijfers en koppeltekens, bv. motor-kopen-tips.");
  if (!f.inhoud.trim()) fout.push("Inhoud is leeg.");
  fout.push(...tekstFouten(f.inhoud, { extern: true, max: 60000, codes: false }).map((x) => `Inhoud: ${x}`));
  fout.push(...tekstFouten(f.beschrijving, { codes: false }).filter((x) => !/^Te /.test(x)).map((x) => `Beschrijving: ${x}`));
  if (f.afbeelding?.url) fout.push(...afbeeldingFouten(f.afbeelding).map((x) => `Afbeelding: ${x}`));
  if (f.status === "gepubliceerd" && !f.gepubliceerd_op) fout.push("Kies een publicatiedatum.");
  return fout;
};

function BlogEditor({ T, s, id, onKlaar, onDirty, onGemaakt }) {
  const leeg = { titel: "", slug: "", beschrijving: "", inhoud: "", categorie: "Koopadvies", afbeelding: null, status: "concept", gepubliceerd_op: "", oude_slugs: [] };
  const [f, setF] = useState(id ? null : leeg);
  const [opgeslagen, setOpgeslagen] = useState(id ? null : leeg);
  const [slugHandmatig, setSlugHandmatig] = useState(!!id);
  const [eigenCategorie, setEigenCategorie] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null);
  const [bevestig, setBevestig] = useState(false);
  const [huidigId, setHuidigId] = useState(id);

  useEffect(() => {
    if (!id) return;
    sb.from("blog_posts").select("*").eq("id", id).single().then(({ data, error }) => {
      if (error || !data) { setMelding({ soort: "fout", tekst: `Laden mislukt: ${foutTekst(error)}` }); return; }
      const v = { ...leeg, ...data, gepubliceerd_op: data.gepubliceerd_op || "", afbeelding: data.afbeelding || null };
      setF(v); setOpgeslagen(v);
      setEigenCategorie(!BLOG_CATEGORIEEN.includes(data.categorie));
    });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = !!f && !!opgeslagen && !gelijk(f, opgeslagen);
  useOnopgeslagen(dirty, onDirty);
  if (!f) return <div><Melding T={T} melding={melding} />{!melding && <span style={{ color: T.muted, fontSize: 13 }}>Laden…</span>}</div>;

  const zet = (d) => { setF((p) => ({ ...p, ...d })); setMelding(null); };
  const fouten = blogFouten(f);
  const wasGepubliceerd = opgeslagen?.status === "gepubliceerd" && !!huidigId;

  const opslaan = async () => {
    if (fouten.length) return;
    setBezig(true); setMelding(null);
    let oude = [...(opgeslagen.oude_slugs || [])];
    if (wasGepubliceerd && opgeslagen.slug && opgeslagen.slug !== f.slug) oude = [...new Set([...oude, opgeslagen.slug])];
    oude = oude.filter((x) => x !== f.slug);
    const rij = {
      titel: f.titel.trim(), slug: f.slug, beschrijving: f.beschrijving.trim(), inhoud: f.inhoud.trim(),
      categorie: f.categorie.trim(), afbeelding: f.afbeelding?.url ? f.afbeelding : null, status: f.status,
      gepubliceerd_op: f.status === "gepubliceerd" ? (f.gepubliceerd_op || vandaagIso()) : (f.gepubliceerd_op || null),
      oude_slugs: oude,
    };
    const { data, error } = huidigId
      ? await sb.from("blog_posts").update(rij).eq("id", huidigId).select().single()
      : await sb.from("blog_posts").insert(rij).select().single();
    setBezig(false);
    if (error || !data) { setMelding({ soort: "fout", tekst: `Niet opgeslagen: ${foutTekst(error)}` }); return; }
    const v = { ...leeg, ...data, gepubliceerd_op: data.gepubliceerd_op || "", afbeelding: data.afbeelding || null };
    setF(v); setOpgeslagen(v); setSlugHandmatig(true);
    if (!huidigId) { setHuidigId(data.id); onGemaakt?.(data.id); }
    setMelding({ soort: "ok", tekst: data.status === "gepubliceerd" ? OPGESLAGEN : "Opgeslagen als concept. Nog niet zichtbaar op de website." });
  };

  const verwijder = async () => {
    setBezig(true);
    const { error } = await sb.from("blog_posts").delete().eq("id", huidigId);
    setBezig(false);
    if (error) { setMelding({ soort: "fout", tekst: `Verwijderen mislukt: ${foutTekst(error)}` }); return; }
    onDirty?.(false);
    onKlaar();
  };

  return (
    <div>
      <div style={{ ...s.card, marginBottom: 14 }}>
        <label style={s.label}>Titel (wordt de kop van het artikel)</label>
        <TekstVeld T={T} s={s} waarde={f.titel} max={90} min={10}
          onChange={(v) => zet({ titel: v, ...(slugHandmatig ? {} : { slug: maakSlug(v) }) })} />
        <label style={{ ...s.label, marginTop: 12 }}>Adres (slug)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>/blog/</span>
          <input style={{ ...s.input, fontSize: 16 }} value={f.slug} onChange={(e) => { setSlugHandmatig(true); zet({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }); }} />
        </div>
        {wasGepubliceerd && f.slug !== opgeslagen.slug && (
          <div style={{ fontSize: 11, color: T.yellow, marginTop: 4 }}>Het oude adres /blog/{opgeslagen.slug} verwijst daarna automatisch door.</div>
        )}
        <label style={{ ...s.label, marginTop: 12 }}>Korte beschrijving (ook de omschrijving in Google)</label>
        <TekstVeld T={T} s={s} waarde={f.beschrijving} onChange={(v) => zet({ beschrijving: v })} max={170} min={70} meerRegels rijen={3} />
        <GoogleVoorbeeld T={T} titel={f.titel} omschrijving={f.beschrijving} pad={`/blog/${f.slug || "…"}`} leegTitel="(titel)" leegOmschrijving="(korte beschrijving)" />
        <label style={{ ...s.label, marginTop: 4 }}>Categorie</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select style={{ ...s.input, fontSize: 16, width: "auto", minWidth: 180 }} value={eigenCategorie ? "__eigen" : f.categorie}
            onChange={(e) => { if (e.target.value === "__eigen") { setEigenCategorie(true); zet({ categorie: "" }); } else { setEigenCategorie(false); zet({ categorie: e.target.value }); } }}>
            {BLOG_CATEGORIEEN.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__eigen">Zelf typen…</option>
          </select>
          {eigenCategorie && <input style={{ ...s.input, fontSize: 16, flex: 1, minWidth: 160 }} value={f.categorie} maxLength={40} placeholder="Categorie" onChange={(e) => zet({ categorie: e.target.value })} />}
        </div>
      </div>

      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={s.sectionLabel}>Afbeelding (optioneel)</div>
        <AfbeeldingVeld T={T} s={s} optioneel waarde={f.afbeelding || LEGE_AFBEELDING} formaat="Liggend, minimaal 1600 × 900 px."
          onChange={(a) => zet({ afbeelding: a.url ? a : null })} />
      </div>

      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={s.sectionLabel}>Inhoud</div>
        <MarkdownVeld T={T} s={s} waarde={f.inhoud} onChange={(v) => zet({ inhoud: v })} />
        <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{telWoorden(f.inhoud)} woorden. De titel is de hoofdkop: begin tussenkoppen met ##.</div>
      </div>

      <div style={{ ...s.card, marginBottom: 6 }}>
        <div style={s.sectionLabel}>Publicatie</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {[["concept", "Concept (niet zichtbaar)"], ["gepubliceerd", "Gepubliceerd"]].map(([st, l]) => (
            <button key={st} type="button" onClick={() => zet({ status: st, ...(st === "gepubliceerd" && !f.gepubliceerd_op ? { gepubliceerd_op: vandaagIso() } : {}) })}
              style={{ ...s.btnGhost, background: f.status === st ? `${T.accent}15` : "transparent", color: f.status === st ? T.accent : T.muted, borderColor: f.status === st ? T.accent : T.border, fontWeight: f.status === st ? 600 : 400 }}>{l}</button>
          ))}
        </div>
        {f.status === "gepubliceerd" && (
          <div>
            <label style={s.label}>Publicatiedatum</label>
            <input type="date" style={{ ...s.input, fontSize: 16, width: "auto" }} value={f.gepubliceerd_op || ""} onChange={(e) => zet({ gepubliceerd_op: e.target.value })} />
          </div>
        )}
      </div>

      <Fouten T={T} lijst={dirty ? fouten : []} />
      <OpslaanBalk T={T} s={s} bezig={bezig} onOpslaan={opslaan} melding={melding} kanOpslaan={dirty && fouten.length === 0}
        links={wasGepubliceerd && !dirty ? <BekijkLink s={s} pad={`/blog/${opgeslagen.slug}`} /> : (huidigId && opgeslagen?.status !== "gepubliceerd" ? <span style={{ fontSize: 12, color: T.muted }}>Nog niet zichtbaar op de website</span> : null)}
        extra={huidigId && (bevestig ? (
          <>
            <span style={{ fontSize: 13 }}>Artikel verwijderen?</span>
            <button type="button" style={{ ...s.btn, background: T.red }} onClick={verwijder}>Ja, verwijderen</button>
            <button type="button" style={s.btnGhost} onClick={() => setBevestig(false)}>Annuleer</button>
          </>
        ) : <button type="button" style={{ ...s.btnGhost, color: T.red }} onClick={() => setBevestig(true)}>Verwijderen</button>)} />
    </div>
  );
}

// ── Dienst- en infopagina's ──────────────────────────────────────────────────
const SJABLONEN = {
  dienst: { naam: "Dienst", pad: "/werkplaats/", uitleg: "Een werkplaatsdienst: banden, kleine beurt, ketting, aankoopkeuring…" },
  info: { naam: "Info", pad: "/info/", uitleg: "Een algemene pagina: garantie, werkgebied, inruilen, verzenden en retourneren…" },
};

function PaginaLijst({ T, s, onOpen }) {
  const [paginas, setPaginas] = useState(null);
  const [kies, setKies] = useState(false);
  const [melding, setMelding] = useState(null);
  const [bezig, setBezig] = useState(false);
  const laad = () => sb.from("website_paginas").select("id,sjabloon,slug,titel,status,in_menu,volgorde,bijgewerkt_op").order("volgorde").order("titel")
    .then(({ data, error }) => { if (error) setMelding({ soort: "fout", tekst: `Laden mislukt: ${foutTekst(error)}` }); setPaginas(data || []); });
  useEffect(() => { laad(); }, []);

  const verplaats = async (i, d) => {
    if (!paginas[i] || !paginas[i + d]) return;
    const nieuw = [...paginas];
    [nieuw[i], nieuw[i + d]] = [nieuw[i + d], nieuw[i]];
    const wijzig = nieuw.map((p, n) => ({ id: p.id, volgorde: n + 1, oud: p.volgorde })).filter((p) => p.oud !== p.volgorde);
    setBezig(true);
    const res = await Promise.all(wijzig.map((p) => sb.from("website_paginas").update({ volgorde: p.volgorde }).eq("id", p.id)));
    setBezig(false);
    if (res.some((r) => r.error)) setMelding({ soort: "fout", tekst: "Volgorde opslaan mislukt." });
    laad();
  };

  const pijl = { ...s.btnGhost, padding: "4px 9px", fontSize: 13 };
  return (
    <div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 12, lineHeight: 1.6 }}>
        Maak zelf pagina's via een vast sjabloon. Dienstpagina's staan op <b>/werkplaats/…</b>, infopagina's op <b>/info/…</b>. De volgorde hieronder is de volgorde in het menu.
      </div>
      {kies ? (
        <div style={{ ...s.card, marginBottom: 12 }}>
          <div style={s.sectionLabel}>Nieuwe pagina: kies een sjabloon</div>
          {Object.entries(SJABLONEN).map(([k, v]) => (
            <button key={k} type="button" onClick={() => onOpen(null, k, (paginas || []).reduce((m, p) => Math.max(m, p.volgorde), 0) + 1)}
              style={{ ...s.card, display: "block", width: "100%", textAlign: "left", marginBottom: 8, cursor: "pointer", color: T.text, fontFamily: "Barlow, sans-serif", padding: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{v.naam}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{v.uitleg}</div>
            </button>
          ))}
          <button type="button" style={s.btnGhost} onClick={() => setKies(false)}>Annuleer</button>
        </div>
      ) : (
        <button type="button" style={{ ...s.btn, marginBottom: 12 }} onClick={() => setKies(true)}>+ Nieuwe pagina</button>
      )}
      <Melding T={T} melding={melding} />
      {!paginas && <div style={{ color: T.muted, fontSize: 13 }}>Laden…</div>}
      {paginas?.length === 0 && <div style={{ ...s.card, color: T.muted, fontSize: 13 }}>Nog geen eigen pagina's.</div>}
      {paginas?.map((p, i) => (
        <div key={p.id} style={{ ...s.card, padding: 12, marginBottom: 8, display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" onClick={() => onOpen(p.id, p.sjabloon)}
            style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", color: T.text, fontFamily: "Barlow, sans-serif" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{p.titel}</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={s.badge(T.muted)}>{SJABLONEN[p.sjabloon]?.naam}</span>
              <span style={s.badge(p.status === "gepubliceerd" ? T.green : T.yellow)}>{p.status === "gepubliceerd" ? "Gepubliceerd" : "Concept"}</span>
              {!p.in_menu && <span>niet in menu</span>}
              <span>· gewijzigd {datumTekst(p.bijgewerkt_op)}</span>
            </div>
          </button>
          <div style={{ display: "flex", gap: 4 }}>
            <button type="button" style={pijl} disabled={i === 0 || bezig} onClick={() => verplaats(i, -1)} aria-label="Omhoog">↑</button>
            <button type="button" style={pijl} disabled={i === paginas.length - 1 || bezig} onClick={() => verplaats(i, 1)} aria-label="Omlaag">↓</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const PAGINA_VELDEN = ["titel", "slug", "intro", "inhoud", "afbeelding", "prijs_tekst", "duur_tekst", "afspraak_soort", "faq", "seo_titel", "seo_omschrijving", "in_menu"];
const naarFormulier = (r, sjabloon) => ({
  sjabloon: r?.sjabloon || sjabloon, titel: r?.titel || "", slug: r?.slug || "", intro: r?.intro || "", inhoud: r?.inhoud || "",
  afbeelding: r?.afbeelding || null, prijs_tekst: r?.prijs_tekst || "", duur_tekst: r?.duur_tekst || "",
  afspraak_soort: r?.afspraak_soort || "", faq: Array.isArray(r?.faq) ? r.faq : [], seo_titel: r?.seo_titel || "",
  seo_omschrijving: r?.seo_omschrijving || "", in_menu: r?.in_menu ?? true, status: r?.status || "concept",
  gepubliceerd_op: r?.gepubliceerd_op || "", oude_slugs: r?.oude_slugs || [],
});

const paginaFouten = (f, tarieven) => {
  const fout = [];
  const t = f.titel.trim(), i = f.intro.trim();
  if (t.length < 10 || t.length > 70) fout.push("Titel: 10 tot 70 tekens.");
  if (!isSlug(f.slug)) fout.push("Adres (slug): alleen kleine letters, cijfers en koppeltekens.");
  if (i.length < 50 || i.length > 400) fout.push(`Introductie: 50 tot 400 tekens (nu ${i.length}).`);
  fout.push(...tekstFouten(f.intro, { tarieven }).filter((x) => !/^Te /.test(x)).map((x) => `Introductie: ${x}`));
  fout.push(...tekstFouten(f.inhoud, { extern: true, max: 60000, codes: false }).map((x) => `Inhoud: ${x}`));
  if (f.sjabloon === "dienst") {
    fout.push(...tekstFouten(f.prijs_tekst, { tarieven, max: 120 }).map((x) => `Prijs: ${x}`));
    if (f.duur_tekst.length > 80) fout.push("Duur: maximaal 80 tekens.");
  }
  if (f.afbeelding?.url) fout.push(...afbeeldingFouten(f.afbeelding).map((x) => `Afbeelding: ${x}`));
  if (f.faq.length > 8) fout.push("Maximaal 8 vragen.");
  f.faq.forEach((q, n) => {
    if (!(q.vraag || "").trim() || (q.vraag || "").length > 140) fout.push(`Vraag ${n + 1}: vul een vraag in (max. 140 tekens).`);
    if ((q.antwoord || "").trim().length < 20 || (q.antwoord || "").length > 900) fout.push(`Vraag ${n + 1}: antwoord van 20 tot 900 tekens.`);
    fout.push(...tekstFouten(q.antwoord, { tarieven }).filter((x) => !/^Te /.test(x)).map((x) => `Vraag ${n + 1}: ${x}`));
  });
  if (f.seo_titel.length > 45) fout.push("Google-titel: maximaal 45 tekens.");
  if (f.seo_omschrijving.length > 160) fout.push("Google-omschrijving: maximaal 160 tekens.");
  if (f.status === "gepubliceerd" && !f.gepubliceerd_op) fout.push("Kies een publicatiedatum.");
  return fout;
};

const SCHRIJFHULP = [
  "Wat houdt het in? Begin met het directe antwoord.",
  "Wat kost het en wat zit erbij inbegrepen?",
  "Hoe lang duurt het, kun je erop wachten?",
  "Hoe gaat het bij De Jonge Motoren? Eigen werkwijze, merken en ervaring.",
  "Veelgestelde vragen.",
];

function PaginaEditor({ T, s, id, sjabloon, volgorde, tarieven, afspraakSoorten, onKlaar, onDirty, onGemaakt }) {
  const [f, setF] = useState(id ? null : naarFormulier(null, sjabloon));
  const [opgeslagen, setOpgeslagen] = useState(id ? null : naarFormulier(null, sjabloon));
  const [huidigId, setHuidigId] = useState(id);
  const [slugHandmatig, setSlugHandmatig] = useState(!!id);
  const [anderen, setAnderen] = useState([]);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState(null);
  const [waarschuwingen, setWaarschuwingen] = useState(null);
  const [versies, setVersies] = useState(null);
  const [bevestig, setBevestig] = useState(false);
  const [hulpOpen, setHulpOpen] = useState(false);

  useEffect(() => {
    let actief = true;
    Promise.all([
      id ? sb.from("website_paginas").select("*").eq("id", id).single() : Promise.resolve({ data: null }),
      sb.from("website_paginas").select("id,sjabloon,titel,intro"),
    ]).then(([eigen, rest]) => {
      if (!actief) return;
      if (id) {
        if (eigen.error || !eigen.data) { setMelding({ soort: "fout", tekst: `Laden mislukt: ${foutTekst(eigen.error)}` }); return; }
        const v = naarFormulier(eigen.data); setF(v); setOpgeslagen(v);
      }
      setAnderen((rest.data || []).filter((p) => p.id !== id));
    });
    return () => { actief = false; };
  }, [id]);

  const dirty = !!f && !!opgeslagen && !gelijk(f, opgeslagen);
  useOnopgeslagen(dirty, onDirty);
  if (!f) return <div><Melding T={T} melding={melding} />{!melding && <span style={{ color: T.muted, fontSize: 13 }}>Laden…</span>}</div>;

  const dienst = f.sjabloon === "dienst";
  const sj = SJABLONEN[f.sjabloon];
  const zet = (d) => { setF((p) => ({ ...p, ...d })); setMelding(null); setWaarschuwingen(null); };
  const fouten = paginaFouten(f, tarieven);
  const wasGepubliceerd = opgeslagen?.status === "gepubliceerd" && !!huidigId;
  const soorten = (afspraakSoorten || []).flatMap((g) => (Array.isArray(g?.items) ? g.items.map((i) => i?.naam || i) : [g?.naam || g])).filter((x) => typeof x === "string" && x);

  const controleer = () => {
    const w = [];
    if (telWoorden(f.inhoud) < 250) w.push("Korte pagina's scoren slecht in Google. Beschrijf jullie werkwijze, wat er precies gebeurt en waarom bij De Jonge Motoren.");
    if (dienst && !f.prijs_tekst.trim()) w.push("Pagina's met een prijs of vanaf-prijs worden vaker gekozen.");
    for (const p of anderen) {
      if (lijktOp(p.titel, f.titel) || lijktOp(p.intro, f.intro)) w.push(`Deze pagina lijkt op "${p.titel}". Twee bijna gelijke pagina's concurreren met elkaar in Google.`);
    }
    return w;
  };

  const opslaan = async (ookMetWaarschuwingen = false) => {
    if (fouten.length) return;
    const wordtGepubliceerd = f.status === "gepubliceerd" && opgeslagen.status !== "gepubliceerd";
    if (wordtGepubliceerd && !ookMetWaarschuwingen) {
      const w = controleer();
      if (w.length) { setWaarschuwingen(w); return; }
    }
    setWaarschuwingen(null); setBezig(true); setMelding(null);
    let oude = [...(opgeslagen.oude_slugs || [])];
    if (wasGepubliceerd && opgeslagen.slug && opgeslagen.slug !== f.slug) oude = [...new Set([...oude, opgeslagen.slug])];
    oude = oude.filter((x) => x !== f.slug);
    const leegNull = (x) => (x || "").trim() || null;
    const rij = {
      sjabloon: f.sjabloon, slug: f.slug, titel: f.titel.trim(), intro: f.intro.trim(), inhoud: f.inhoud.trim(),
      afbeelding: f.afbeelding?.url ? f.afbeelding : null,
      prijs_tekst: dienst ? leegNull(f.prijs_tekst) : null, duur_tekst: dienst ? leegNull(f.duur_tekst) : null,
      afspraak_soort: dienst ? leegNull(f.afspraak_soort) : null,
      faq: f.faq.map((q) => ({ vraag: q.vraag.trim(), antwoord: q.antwoord.trim() })),
      seo_titel: leegNull(f.seo_titel), seo_omschrijving: leegNull(f.seo_omschrijving), in_menu: !!f.in_menu,
      status: f.status, gepubliceerd_op: f.status === "gepubliceerd" ? (f.gepubliceerd_op || vandaagIso()) : (f.gepubliceerd_op || null),
      oude_slugs: oude,
      ...(huidigId ? {} : { volgorde: volgorde || 0 }),
    };
    const { data, error } = huidigId
      ? await sb.from("website_paginas").update(rij).eq("id", huidigId).select().single()
      : await sb.from("website_paginas").insert(rij).select().single();
    setBezig(false);
    if (error || !data) { setMelding({ soort: "fout", tekst: `Niet opgeslagen: ${foutTekst(error)}` }); return; }
    const v = naarFormulier(data); setF(v); setOpgeslagen(v); setSlugHandmatig(true); setVersies(null);
    if (!huidigId) { setHuidigId(data.id); onGemaakt?.(data.id); }
    setMelding({ soort: "ok", tekst: data.status === "gepubliceerd" ? OPGESLAGEN : "Opgeslagen als concept. Nog niet zichtbaar op de website." });
  };

  const laadVersies = async () => {
    setVersies("laden");
    const { data, error } = await sb.from("website_paginas_historie").select("id,versie,gewijzigd_op").eq("pagina_id", huidigId)
      .order("gewijzigd_op", { ascending: false }).limit(20);
    if (error) { setVersies(null); setMelding({ soort: "fout", tekst: foutTekst(error) }); return; }
    setVersies(data || []);
  };
  const zetVersieTerug = (versie) => {
    const v = naarFormulier(versie);
    zet(Object.fromEntries(PAGINA_VELDEN.map((k) => [k, v[k]])));
    setVersies(null);
    setMelding({ soort: "info", tekst: "Versie teruggezet in het formulier. Tik op Opslaan om hem weer live te zetten." });
  };

  const verwijder = async () => {
    setBezig(true);
    const { error } = await sb.from("website_paginas").delete().eq("id", huidigId);
    setBezig(false);
    if (error) { setMelding({ soort: "fout", tekst: `Verwijderen mislukt: ${foutTekst(error)}` }); return; }
    onDirty?.(false);
    onKlaar();
  };

  const zetFaq = (i, d) => zet({ faq: f.faq.map((q, j) => (j === i ? { ...q, ...d } : q)) });
  const pijl = { ...s.btnGhost, padding: "4px 9px", fontSize: 13 };

  return (
    <div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Sjabloon: <b>{sj.naam}</b> · adres {sj.pad}{f.slug || "…"}</div>

      {dienst && (
        <div style={{ ...s.card, marginBottom: 14, padding: 14 }}>
          <button type="button" onClick={() => setHulpOpen((o) => !o)} style={{ background: "none", border: "none", padding: 0, color: T.accent, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "Barlow, sans-serif" }}>
            {hulpOpen ? "▴" : "▾"} Schrijfhulp voor een dienstpagina
          </button>
          {hulpOpen && <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: T.text }}>{SCHRIJFHULP.map((h) => <li key={h}>{h}</li>)}</ol>}
        </div>
      )}

      <div style={{ ...s.card, marginBottom: 14 }}>
        <label style={s.label}>Titel (wordt de hoofdkop)</label>
        <TekstVeld T={T} s={s} waarde={f.titel} max={70} min={10}
          hulp={dienst ? "Noem de dienst en de plaats, bv. 'Motorbanden wisselen in Tholen'." : undefined}
          onChange={(v) => zet({ titel: v, ...(slugHandmatig ? {} : { slug: maakSlug(v) }) })} />
        <label style={{ ...s.label, marginTop: 12 }}>Adres (slug)</label>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 13, color: T.muted, whiteSpace: "nowrap" }}>{sj.pad}</span>
          <input style={{ ...s.input, fontSize: 16 }} value={f.slug} onChange={(e) => { setSlugHandmatig(true); zet({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }); }} />
        </div>
        {wasGepubliceerd && f.slug !== opgeslagen.slug && (
          <div style={{ fontSize: 11, color: T.yellow, marginTop: 4 }}>Het oude adres {sj.pad}{opgeslagen.slug} verwijst daarna automatisch door.</div>
        )}
        <label style={{ ...s.label, marginTop: 12 }}>Introductie</label>
        <TekstVeld T={T} s={s} waarde={f.intro} onChange={(v) => zet({ intro: v })} max={400} min={50} meerRegels rijen={3} codes tarieven={tarieven}
          hulp={dienst ? "Beantwoord in 2 zinnen wat de dienst is en wat het kost." : undefined} />
      </div>

      {dienst && (
        <div style={{ ...s.card, marginBottom: 14 }}>
          <div style={s.sectionLabel}>Prijs, duur en afspraak</div>
          <label style={s.label}>Prijs</label>
          <TekstVeld T={T} s={s} waarde={f.prijs_tekst} onChange={(v) => zet({ prijs_tekst: v })} max={120} codes tarieven={tarieven}
            placeholder="Bijv. € 25 per band, montage en balanceren inbegrepen" hulp="Leeg = de website toont 'Prijs op aanvraag'." />
          <label style={{ ...s.label, marginTop: 12 }}>Duur</label>
          <TekstVeld T={T} s={s} waarde={f.duur_tekst} onChange={(v) => zet({ duur_tekst: v })} max={80} placeholder="Bijv. Klaar terwijl je wacht, ongeveer een uur" />
          <label style={{ ...s.label, marginTop: 12 }}>Afspraaksoort (het formulier op de pagina staat hier al op)</label>
          <select style={{ ...s.input, fontSize: 16 }} value={f.afspraak_soort} onChange={(e) => zet({ afspraak_soort: e.target.value })}>
            <option value="">Geen (bezoeker kiest zelf)</option>
            {soorten.map((n) => <option key={n} value={n}>{n}</option>)}
            {f.afspraak_soort && !soorten.includes(f.afspraak_soort) && <option value={f.afspraak_soort}>{f.afspraak_soort} (bestaat niet meer)</option>}
          </select>
        </div>
      )}

      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={s.sectionLabel}>Inhoud</div>
        <MarkdownVeld T={T} s={s} waarde={f.inhoud} onChange={(v) => zet({ inhoud: v })} tarieven={tarieven} />
        <div style={{ fontSize: 11, color: telWoorden(f.inhoud) < 250 ? T.yellow : T.muted, marginTop: 4 }}>{telWoorden(f.inhoud)} woorden{telWoorden(f.inhoud) < 250 ? " (advies: minimaal 250)" : ""}</div>
      </div>

      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={s.sectionLabel}>Afbeelding (optioneel)</div>
        <AfbeeldingVeld T={T} s={s} optioneel waarde={f.afbeelding || LEGE_AFBEELDING} formaat="Liggend, minimaal 1600 × 1200 px."
          onChange={(a) => zet({ afbeelding: a.url ? a : null })} />
      </div>

      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={s.sectionLabel}>Veelgestelde vragen op deze pagina ({f.faq.length}/8)</div>
        {f.faq.map((q, i) => (
          <div key={i} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: 12, marginBottom: 10, background: T.surf2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.muted }}>Vraag {i + 1}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" style={pijl} disabled={i === 0} onClick={() => { const k = [...f.faq]; [k[i - 1], k[i]] = [k[i], k[i - 1]]; zet({ faq: k }); }} aria-label="Omhoog">↑</button>
                <button type="button" style={pijl} disabled={i === f.faq.length - 1} onClick={() => { const k = [...f.faq]; [k[i + 1], k[i]] = [k[i], k[i + 1]]; zet({ faq: k }); }} aria-label="Omlaag">↓</button>
                <button type="button" style={{ ...pijl, color: T.red }} onClick={() => zet({ faq: f.faq.filter((_, j) => j !== i) })} aria-label="Verwijderen">✕</button>
              </div>
            </div>
            <TekstVeld T={T} s={s} waarde={q.vraag} onChange={(v) => zetFaq(i, { vraag: v })} max={140} placeholder="Vraag" />
            <div style={{ height: 8 }} />
            <TekstVeld T={T} s={s} waarde={q.antwoord} onChange={(v) => zetFaq(i, { antwoord: v })} max={900} min={20} meerRegels rijen={4} codes tarieven={tarieven} placeholder="Antwoord" />
          </div>
        ))}
        {f.faq.length < 8 && <button type="button" style={s.btnOutline} onClick={() => zet({ faq: [...f.faq, { vraag: "", antwoord: "" }] })}>+ Vraag toevoegen</button>}
      </div>

      <div style={{ ...s.card, marginBottom: 14 }}>
        <div style={s.sectionLabel}>Google (optioneel)</div>
        <GoogleVoorbeeld T={T} pad={`${sj.pad}${f.slug || "…"}`} titel={f.seo_titel} omschrijving={f.seo_omschrijving}
          leegTitel={f.titel ? f.titel : "(titel van de pagina)"} leegOmschrijving={f.intro ? f.intro.slice(0, 160) : "(introductie)"} />
        <label style={s.label}>Google-titel</label>
        <TekstVeld T={T} s={s} waarde={f.seo_titel} onChange={(v) => zet({ seo_titel: v })} max={45} placeholder="Leeg = de titel van de pagina" />
        <label style={{ ...s.label, marginTop: 10 }}>Google-omschrijving</label>
        <TekstVeld T={T} s={s} waarde={f.seo_omschrijving} onChange={(v) => zet({ seo_omschrijving: v })} max={160} min={120} meerRegels rijen={3} placeholder="Leeg = de introductie" />
      </div>

      <div style={{ ...s.card, marginBottom: 6 }}>
        <div style={s.sectionLabel}>Publicatie</div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
          <input type="checkbox" checked={!!f.in_menu} onChange={(e) => zet({ in_menu: e.target.checked })} style={{ width: 18, height: 18 }} />
          Tonen in menu ({dienst ? "overzicht op /werkplaats en " : ""}footer)
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {[["concept", "Concept (niet zichtbaar)"], ["gepubliceerd", "Gepubliceerd"]].map(([st, l]) => (
            <button key={st} type="button" onClick={() => zet({ status: st, ...(st === "gepubliceerd" && !f.gepubliceerd_op ? { gepubliceerd_op: vandaagIso() } : {}) })}
              style={{ ...s.btnGhost, background: f.status === st ? `${T.accent}15` : "transparent", color: f.status === st ? T.accent : T.muted, borderColor: f.status === st ? T.accent : T.border, fontWeight: f.status === st ? 600 : 400 }}>{l}</button>
          ))}
        </div>
        {huidigId && (
          <div style={{ marginTop: 4 }}>
            {versies === null && <button type="button" style={{ ...s.btnGhost, fontSize: 12, padding: "5px 10px" }} onClick={laadVersies}>Vorige versies</button>}
            {versies === "laden" && <span style={{ fontSize: 12, color: T.muted }}>Laden…</span>}
            {Array.isArray(versies) && (
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: 10, background: T.surf2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Vorige versies</span>
                  <button type="button" style={{ ...s.btnGhost, padding: "3px 9px", fontSize: 12 }} onClick={() => setVersies(null)}>Sluiten</button>
                </div>
                {versies.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>Nog geen eerdere versies.</div>}
                {versies.map((v) => (
                  <div key={v.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${T.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: T.muted }}>{datumTijdTekst(v.gewijzigd_op)}</div>
                      <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.versie?.titel}</div>
                    </div>
                    <button type="button" style={{ ...s.btnOutline, padding: "4px 10px", fontSize: 12 }} onClick={() => zetVersieTerug(v.versie)}>Terugzetten</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {waarschuwingen && (
        <div style={{ ...s.card, borderColor: T.yellow, marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Voor je publiceert</div>
          {waarschuwingen.map((w, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, color: T.text, marginBottom: 4 }}>• {w}</div>)}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" style={s.btn} onClick={() => opslaan(true)}>Toch publiceren</button>
            <button type="button" style={s.btnGhost} onClick={() => setWaarschuwingen(null)}>Eerst aanpassen</button>
          </div>
        </div>
      )}

      <Fouten T={T} lijst={dirty ? fouten : []} />
      <OpslaanBalk T={T} s={s} bezig={bezig} onOpslaan={() => opslaan(false)} melding={melding} kanOpslaan={dirty && fouten.length === 0}
        links={wasGepubliceerd && !dirty ? <BekijkLink s={s} pad={`${sj.pad}${opgeslagen.slug}`} /> : (huidigId && opgeslagen?.status !== "gepubliceerd" ? <span style={{ fontSize: 12, color: T.muted }}>Nog niet zichtbaar op de website</span> : null)}
        extra={huidigId && (bevestig ? (
          <>
            <span style={{ fontSize: 13 }}>Pagina verwijderen?</span>
            <button type="button" style={{ ...s.btn, background: T.red }} onClick={verwijder}>Ja, verwijderen</button>
            <button type="button" style={s.btnGhost} onClick={() => setBevestig(false)}>Annuleer</button>
          </>
        ) : <button type="button" style={{ ...s.btnGhost, color: T.red }} onClick={() => setBevestig(true)}>Verwijderen</button>)} />
    </div>
  );
}

// ── Startscherm ──────────────────────────────────────────────────────────────
function Startscherm({ T, s, onKies }) {
  const [laatst, setLaatst] = useState({});
  const [tellers, setTellers] = useState({});
  useEffect(() => {
    let actief = true;
    Promise.all([
      sb.from("website_blokken").select("pagina,bijgewerkt_op"),
      sb.from("website_faq").select("bijgewerkt_op,actief"),
      sb.from("blog_posts").select("bijgewerkt_op,status"),
      sb.from("website_paginas").select("bijgewerkt_op,status"),
    ]).then(([b, f, bl, p]) => {
      if (!actief) return;
      const max = (rijen) => (rijen || []).reduce((m, r) => (r.bijgewerkt_op > m ? r.bijgewerkt_op : m), "");
      const perPagina = {};
      for (const r of b.data || []) if (!perPagina[r.pagina] || r.bijgewerkt_op > perPagina[r.pagina]) perPagina[r.pagina] = r.bijgewerkt_op;
      setLaatst({ ...perPagina, faq: max(f.data), blog: max(bl.data), paginas: max(p.data) });
      setTellers({
        faq: `${(f.data || []).filter((x) => x.actief).length} vragen`,
        blog: `${(bl.data || []).filter((x) => x.status === "gepubliceerd").length} gepubliceerd`,
        paginas: `${(p.data || []).length} pagina's`,
      });
    });
    return () => { actief = false; };
  }, []);

  const tegel = (key, titel, onder, actie) => (
    <button key={key} type="button" onClick={actie}
      style={{ ...s.card, padding: 14, textAlign: "left", cursor: "pointer", color: T.text, fontFamily: "Barlow, sans-serif", display: "flex", flexDirection: "column", gap: 4, minHeight: 74 }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{titel}</span>
      <span style={{ fontSize: 11, color: T.muted }}>{onder || "\u00a0"}</span>
    </button>
  );
  const gewijzigd = (k) => (laatst[k] ? `Gewijzigd ${datumTekst(laatst[k])}` : "");
  const raster = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 18 };
  return (
    <div>
      <div style={{ fontSize: 13, color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>
        Pas de inhoud van <a href={SITE_URL} target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>{SITE_HOST}</a> aan. Opmaak, formulieren en de technische kant blijven zoals ze zijn. Een wijziging staat na Opslaan direct op de website.
      </div>
      <div style={s.sectionLabel}>Pagina's</div>
      <div style={raster}>{PAGINAS.map((p) => tegel(p.id, p.naam, gewijzigd(p.id), () => onKies({ soort: "pagina", pagina: p.id })))}</div>
      <div style={s.sectionLabel}>Overig</div>
      <div style={raster}>
        {tegel("faq", "Veelgestelde vragen", [tellers.faq, gewijzigd("faq")].filter(Boolean).join(" · "), () => onKies({ soort: "faq" }))}
        {tegel("blog", "Blog", [tellers.blog, gewijzigd("blog")].filter(Boolean).join(" · "), () => onKies({ soort: "blog" }))}
        {tegel("seo", "Google-teksten", gewijzigd("seo"), () => onKies({ soort: "pagina", pagina: "seo" }))}
        {tegel("paginas", "Dienst- en infopagina's", [tellers.paginas, gewijzigd("paginas")].filter(Boolean).join(" · "), () => onKies({ soort: "paginas" }))}
      </div>
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
        Openingstijden, gesloten dagen, tarieven, werkplaatsdiensten, de meldingsbalk, voorraad en onderdelen pas je aan op hun eigen plek in de app; de website neemt ze automatisch over.
      </div>
    </div>
  );
}

// ── Hoofdcomponent ───────────────────────────────────────────────────────────
export default function WebsiteBeheer({ T, s, dienstenTarieven = {}, afspraakSoorten = [], zetVerlaatGuard, onTerug }) {
  const [scherm, setScherm] = useState({ soort: "start" });
  const dirtyRef = useRef(false);
  const onDirty = useMemo(() => (d) => { dirtyRef.current = d; }, []);

  // AdminApp vraagt dit voordat hij naar een ander tabblad gaat
  useEffect(() => {
    zetVerlaatGuard?.(() => !dirtyRef.current || window.confirm(ONOPGESLAGEN));
    return () => zetVerlaatGuard?.(null);
  }, [zetVerlaatGuard]);

  const gaNaar = (nieuw) => {
    if (dirtyRef.current && !window.confirm(ONOPGESLAGEN)) return;
    dirtyRef.current = false;
    setScherm(nieuw);
  };

  const tarieven = dienstenTarieven || {};
  let titel = "Website aanpassen", terug = null, inhoud;
  if (scherm.soort === "start") {
    terug = { label: "← Instellingen", actie: () => { if (!dirtyRef.current || window.confirm(ONOPGESLAGEN)) { dirtyRef.current = false; onTerug?.(); } } };
    inhoud = <Startscherm T={T} s={s} onKies={gaNaar} />;
  } else if (scherm.soort === "pagina") {
    const p = scherm.pagina === "seo" ? { naam: "Google-teksten", pad: null } : PAGINAS.find((x) => x.id === scherm.pagina);
    titel = p?.naam || scherm.pagina;
    terug = { label: "← Website", actie: () => gaNaar({ soort: "start" }) };
    inhoud = <BlokkenEditor key={scherm.pagina} T={T} s={s} pagina={scherm.pagina} naam={p?.naam} pad={p?.pad} tarieven={tarieven} onDirty={onDirty} />;
  } else if (scherm.soort === "faq") {
    titel = "Veelgestelde vragen";
    terug = { label: "← Website", actie: () => gaNaar({ soort: "start" }) };
    inhoud = <FaqBeheer T={T} s={s} tarieven={tarieven} onDirty={onDirty} />;
  } else if (scherm.soort === "blog") {
    titel = "Blog";
    terug = { label: "← Website", actie: () => gaNaar({ soort: "start" }) };
    inhoud = <BlogLijst T={T} s={s} onOpen={(id) => gaNaar({ soort: "blogEdit", id, sleutel: id || `nieuw-${Date.now()}` })} />;
  } else if (scherm.soort === "blogEdit") {
    titel = scherm.id ? "Artikel bewerken" : "Nieuw artikel";
    terug = { label: "← Blog", actie: () => gaNaar({ soort: "blog" }) };
    inhoud = <BlogEditor key={scherm.sleutel} T={T} s={s} id={scherm.id} onDirty={onDirty}
      onGemaakt={(id) => setScherm((sc) => ({ ...sc, id }))} onKlaar={() => gaNaar({ soort: "blog" })} />;
  } else if (scherm.soort === "paginas") {
    titel = "Dienst- en infopagina's";
    terug = { label: "← Website", actie: () => gaNaar({ soort: "start" }) };
    inhoud = <PaginaLijst T={T} s={s} onOpen={(id, sjabloon, volgorde) => gaNaar({ soort: "paginaEdit", id, sjabloon, volgorde, sleutel: id || `nieuw-${Date.now()}` })} />;
  } else if (scherm.soort === "paginaEdit") {
    titel = scherm.id ? "Pagina bewerken" : `Nieuwe ${SJABLONEN[scherm.sjabloon]?.naam.toLowerCase()}pagina`;
    terug = { label: "← Pagina's", actie: () => gaNaar({ soort: "paginas" }) };
    inhoud = <PaginaEditor key={scherm.sleutel} T={T} s={s} id={scherm.id} sjabloon={scherm.sjabloon}
      volgorde={scherm.volgorde} tarieven={tarieven} afspraakSoorten={afspraakSoorten} onDirty={onDirty}
      onGemaakt={(id) => setScherm((sc) => ({ ...sc, id }))} onKlaar={() => gaNaar({ soort: "paginas" })} />;
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        {terug && <button type="button" style={{ ...s.btnGhost, padding: "6px 12px" }} onClick={terug.actie}>{terug.label}</button>}
        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: 0.5 }}>{titel}</div>
      </div>
      {inhoud}
    </div>
  );
}
