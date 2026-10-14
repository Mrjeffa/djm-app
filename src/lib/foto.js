// Foto's verkleinen en uploaden naar Cloudinary — gedeeld door admin- en klant-app.
//
// Robuust voor telefoons:
// - het bestand wordt direct bij het kiezen in het geheugen gelezen; sommige
//   galerij-apps (bv. Google Foto's) geven een bestand dat later niet opnieuw
//   leesbaar is ("Kan afbeelding niet laden" bij opslaan);
// - foto's worden één voor één verkleind, niet allemaal tegelijk (geheugen);
// - kan de browser het formaat niet openen (bv. HEIC), dan gaat het origineel
//   naar Cloudinary, dat zet het om naar jpg.

const CL_CLOUD = "dkfdwnep4";
const CL_PRESET = "Djm app";
const MAX_ZIJDE = 1920;
const DOEL_BYTES = 1024 * 1024;           // na verkleinen hooguit ~1 MB
const CLOUDINARY_MAX = 10 * 1024 * 1024;  // grens van Cloudinary voor een foto

const mb = (n) => (n / 1024 / 1024).toLocaleString("nl-NL", { maximumFractionDigits: 1 });

// Decodeer een afbeelding; null als de browser het formaat niet kan openen.
const decodeer = async (blob) => {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); }
    catch { /* oudere browser of onbekende optie: probeer <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
};

// Geeft een File terug die klaar is om te uploaden (meestal een jpg van ≤ ~1 MB).
export const verkleinFoto = async (file) => {
  const naam = file.name || "foto";
  let bytes;
  try {
    bytes = new Blob([await file.arrayBuffer()], { type: file.type });
  } catch {
    throw new Error(`Foto "${naam}" kon niet worden gelezen. Kies hem opnieuw, bij voorkeur via Galerij of Bestanden.`);
  }
  const origineel = new File([bytes], naam, { type: file.type });
  if (bytes.size <= DOEL_BYTES) return origineel;

  const beeld = await decodeer(bytes);
  if (!beeld) {
    if (bytes.size <= CLOUDINARY_MAX) return origineel; // Cloudinary zet het om
    throw new Error(`Foto "${naam}" (${file.type || "onbekend type"}, ${mb(bytes.size)} MB) kan niet worden geopend. Zet de camera op JPG of maak een screenshot van de foto.`);
  }
  let w = beeld.width, h = beeld.height;
  if (w > MAX_ZIJDE || h > MAX_ZIJDE) {
    if (w > h) { h = Math.round(h * MAX_ZIJDE / w); w = MAX_ZIJDE; }
    else { w = Math.round(w * MAX_ZIJDE / h); h = MAX_ZIJDE; }
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(beeld, 0, 0, w, h);
  beeld.close?.();
  let q = 0.85, blob;
  do { blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q)); q -= 0.1; }
  while (blob && blob.size > DOEL_BYTES && q > 0.1);
  canvas.width = canvas.height = 0; // geheugen direct vrijgeven
  if (!blob) {
    if (bytes.size <= CLOUDINARY_MAX) return origineel;
    throw new Error(`Foto "${naam}" verkleinen mislukt (${mb(bytes.size)} MB).`);
  }
  return new File([blob], naam.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
};

// Verklein meerdere foto's één voor één. Mislukte foto's worden overgeslagen
// en als foutmelding teruggegeven, zodat de rest gewoon doorgaat.
export const verkleinFotos = async (files) => {
  const klaar = [], fouten = [];
  for (const f of files) {
    try { klaar.push(await verkleinFoto(f)); }
    catch (e) { fouten.push(e.message); }
  }
  return { klaar, fouten };
};

// Upload een (al verkleinde) foto; geeft de Cloudinary-URL terug.
export const uploadFoto = async (file) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CL_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CL_CLOUD}/image/upload`, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.secure_url) throw new Error(data.error?.message || `Uploaden mislukt (${res.status})`);
  // HEIC e.d. als jpg opvragen, zodat elke browser (en de website) hem kan tonen
  return data.secure_url.replace(/\.(heic|heif|avif|tiff?|bmp)$/i, ".jpg");
};
