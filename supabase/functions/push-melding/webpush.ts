// Web Push (RFC 8030 / 8291 / 8292) met alleen WebCrypto: geen externe
// bibliotheek nodig, werkt in Supabase edge functions (Deno) en in Node 20+.
//  - VAPID: ES256-ondertekend JWT, zodat de pushdienst weet dat wij de afzender zijn
//  - aes128gcm: de inhoud is versleuteld; alleen het apparaat van de beheerder kan hem lezen

const enc = new TextEncoder();

export const b64url = {
  encode(data: ArrayBuffer | Uint8Array): string {
    const b = data instanceof Uint8Array ? data : new Uint8Array(data);
    let s = "";
    for (const x of b) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(s: string): Uint8Array {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  },
};

const samen = (...delen: Uint8Array[]) => {
  const uit = new Uint8Array(delen.reduce((n, d) => n + d.length, 0));
  let o = 0;
  for (const d of delen) { uit.set(d, o); o += d.length; }
  return uit;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, lengte: number) {
  const sleutel = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, sleutel, lengte * 8));
}

export type Vapid = { publicKey: string; privateJwk: JsonWebKey; subject: string };
export type Abonnement = { endpoint: string; p256dh: string; auth: string };

// Authorization-header voor de pushdienst (RFC 8292)
export async function vapidHeader(endpoint: string, v: Vapid): Promise<string> {
  const kop = b64url.encode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64url.encode(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: v.subject,
  })));
  const sleutel = await crypto.subtle.importKey("jwk", v.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const handtekening = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, sleutel, enc.encode(`${kop}.${claims}`));
  return `vapid t=${kop}.${claims}.${b64url.encode(handtekening)}, k=${v.publicKey}`;
}

// Versleutel de inhoud voor één apparaat (RFC 8291, aes128gcm, één record)
export async function versleutel(inhoud: Uint8Array, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaPubliek = b64url.decode(p256dh);
  const authGeheim = b64url.decode(auth);
  const ons = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const onsPubliek = new Uint8Array(await crypto.subtle.exportKey("raw", ons.publicKey));
  const zijnSleutel = await crypto.subtle.importKey("raw", uaPubliek, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const gedeeld = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: zijnSleutel }, ons.privateKey, 256));

  const ikm = await hkdf(authGeheim, gedeeld, samen(enc.encode("WebPush: info\0"), uaPubliek, onsPubliek), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const versleuteld = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, samen(inhoud, new Uint8Array([2]))));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return samen(salt, rs, new Uint8Array([onsPubliek.length]), onsPubliek, versleuteld);
}

// Stuur één melding naar één apparaat. Status 404/410 = abonnement verlopen.
export async function stuurPush(ab: Abonnement, data: unknown, v: Vapid, ttl = 24 * 3600) {
  const body = await versleutel(enc.encode(JSON.stringify(data)), ab.p256dh, ab.auth);
  const res = await fetch(ab.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: "high",
      Authorization: await vapidHeader(ab.endpoint, v),
    },
    body,
  });
  return { status: res.status, ok: res.ok, tekst: res.ok ? "" : (await res.text()).slice(0, 200) };
}
