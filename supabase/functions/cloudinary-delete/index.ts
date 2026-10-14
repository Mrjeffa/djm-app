// Edge function: cloudinary-delete
//
// Verwijdert foto's van verkochte/verlopen voorraad en producten uit Cloudinary.
// Aanroepen (POST, JSON): { "urls": ["https://res.cloudinary.com/dkfdwnep4/image/upload/..."] }
//
// Toegang: alleen ingelogde admins (is_admin()). verify_jwt alleen is niet
// genoeg: de publieke anon key is óók een geldige JWT. Alleen URL's uit ons
// eigen Cloudinary-account worden geaccepteerd.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CLOUD_NAME = "dkfdwnep4";
const EIGEN_PREFIX = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/`;
const MAX_URLS = 100;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function extractPublicId(url: string): string | null {
  if (typeof url !== "string" || !url.startsWith(EIGEN_PREFIX)) return null;
  let path = url.slice(EIGEN_PREFIX.length).split(/[?#]/)[0];
  // alles t/m de versie weg (eventuele transformaties staan daarvóór):
  // c_scale,w_800/v1234567890/abc.jpg → abc.jpg
  const naVersie = path.match(/(?:^|\/)v\d+\/(.+)$/);
  if (naVersie) path = naVersie[1];
  // strip file extension
  path = path.replace(/\.[^./]+$/, "");
  try { path = decodeURIComponent(path); } catch { return null; }
  return path && !path.includes("..") ? path : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Alleen POST" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Niet ingelogd" }, 401);
  const gebruiker = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: isAdmin } = await gebruiker.rpc("is_admin");
  if (isAdmin !== true) return json({ error: "Geen toegang" }, 403);

  let urls: unknown;
  try { ({ urls } = await req.json()); } catch { return json({ error: "Ongeldige JSON" }, 400); }
  if (!Array.isArray(urls) || urls.length === 0) return json({ deleted: 0 });
  if (urls.length > MAX_URLS) return json({ error: `Maximaal ${MAX_URLS} foto's per keer` }, 400);

  const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!apiKey || !apiSecret) {
    console.error("Cloudinary credentials not configured");
    return json({ error: "Credentials not configured" }, 500);
  }

  const publicIds = [...new Set(urls.map((u) => extractPublicId(u as string)).filter((id): id is string => id !== null))];
  if (publicIds.length === 0) return json({ deleted: 0 });

  const params = publicIds.map((id) => `public_ids[]=${encodeURIComponent(id)}`).join("&");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload?${params}`,
    { method: "DELETE", headers: { Authorization: `Basic ${btoa(`${apiKey}:${apiSecret}`)}` } },
  );
  const result = await res.json();
  console.log("Cloudinary delete result:", JSON.stringify(result));
  return json({ deleted: publicIds.length, result }, res.ok ? 200 : 502);
});
