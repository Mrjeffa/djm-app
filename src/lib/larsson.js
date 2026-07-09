// ── Larsson onderdelen-deeplinks ─────────────────────────────────────────────
// De opzoektabel (public/larsson_voertuigen.json) bevat per model-slug een
// mapping bouwjaar → Larsson VehicleID. We matchen merk+model fuzzy op de slug
// en kiezen het exacte of dichtstbijzijnde bouwjaar. Zo landt "Onderdelen
// bestellen" op de juiste motor + het juiste bouwjaar op mike2.larsson.nl.

let _dataPromise = null;

// Laadt de opzoektabel één keer en cachet hem in het geheugen.
const laadData = () => {
  if (!_dataPromise) {
    const base = (import.meta?.env?.BASE_URL) || "/";
    _dataPromise = fetch(`${base}larsson_voertuigen.json`)
      .then(r => r.ok ? r.json() : {})
      .catch(() => ({}));
  }
  return _dataPromise;
};

// Genormaliseerde vorm: kleine letters, alleen a-z0-9 (spaties/streepjes weg).
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Bigrammen van een string (voor Dice-similariteit).
const bigrams = (s) => {
  const set = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const b = s.slice(i, i + 2);
    set.set(b, (set.get(b) || 0) + 1);
  }
  return set;
};

// Dice-coëfficiënt tussen twee genormaliseerde strings (0..1).
const dice = (a, b) => {
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  const A = bigrams(a), B = bigrams(b);
  let overlap = 0;
  for (const [g, c] of A) if (B.has(g)) overlap += Math.min(c, B.get(g));
  const total = (a.length - 1) + (b.length - 1);
  return (2 * overlap) / total;
};

// Zoekt de beste Larsson-URL voor merk/model/bouwjaar. Geeft null als er geen
// betrouwbare match is (frontend valt dan terug op een zoekopdracht).
export const zoekLarssonLink = async (merk, model, bouwjaar) => {
  const data = await laadData();
  const slugs = Object.keys(data);
  if (!slugs.length) return null;

  const query = norm(`${merk || ""} ${model || ""}`);
  if (query.length < 3) return null;
  const merkNorm = norm(merk);

  let besteSlug = null, besteScore = 0;
  for (const slug of slugs) {
    const slugNorm = norm(slug);
    let score = dice(query, slugNorm);
    // Bonus als het merk klopt (voorkomt kruis-merk matches bij korte modellen)
    if (merkNorm && slugNorm.startsWith(merkNorm)) score += 0.15;
    if (score > besteScore) { besteScore = score; besteSlug = slug; }
  }

  // Drempel: te lage gelijkenis → geen betrouwbare match
  if (!besteSlug || besteScore < 0.5) return null;

  // Binnen de slug: exact bouwjaar, anders dichtstbijzijnde
  const paren = data[besteSlug].split(";").map(p => {
    const [jaar, id] = p.split(":");
    return { jaar: parseInt(jaar) || 0, id };
  });
  const doel = parseInt(bouwjaar) || 0;
  let beste = paren[0];
  if (doel) {
    beste = paren.reduce((acc, p) =>
      Math.abs(p.jaar - doel) < Math.abs(acc.jaar - doel) ? p : acc, paren[0]);
  } else {
    // Geen bouwjaar bekend → meest recente
    beste = paren.reduce((acc, p) => p.jaar > acc.jaar ? p : acc, paren[0]);
  }
  return `https://mike2.larsson.nl/nl/vehicle/${besteSlug}:${beste.id}`;
};

// Fallback: gerichte zoekopdracht op de leverancierssite via Google.
export const larssonZoekFallback = (merk, model) => {
  const q = encodeURIComponent([merk, model].filter(Boolean).join(" ").trim());
  return `https://www.google.com/search?q=${q}+site%3Amike2.larsson.nl`;
};

// Opent "Onderdelen bestellen" voor een motor. Voorrang:
// 1) handmatig ingevulde directe link, 2) Larsson-match, 3) zoek-fallback.
// Opent eerst synchroon een tab (popup-safe) en zet daarna de juiste URL.
export const openOnderdelen = async ({ merk, model, bouwjaar, handmatig }) => {
  const tab = window.open("", "_blank", "noopener");
  let url = handmatig && handmatig.trim() ? handmatig.trim() : null;
  if (!url) {
    try { url = await zoekLarssonLink(merk, model, bouwjaar); } catch { url = null; }
  }
  if (!url) url = larssonZoekFallback(merk, model);
  if (tab) tab.location = url;
  else window.location.href = url;
};

// Warmt de cache op (optioneel, bij openen van de admin-app aangeroepen).
export const preloadLarsson = () => { laadData(); };
