import { describe, it, expect } from "vitest";
import { b64urlDecode, b64urlEncode, deriveKeys, encryptPayload, vapidAuthorization } from "../../supabase/functions/_shared/webpush";
import { isReportDue, localMidnight, reportWeek, safeTimeZone, weeklyMessage, weekTotals } from "../../supabase/functions/_shared/weekly";

/** A browser's push keys, like PushSubscription.getKey() returns. */
async function browserKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { pair, pub, auth, sub: { p256dh: b64urlEncode(pub), auth: b64urlEncode(auth) } };
}

/** What the browser does with a push message (RFC 8291), to check ours. */
async function decrypt(body: Uint8Array, ua: Awaited<ReturnType<typeof browserKeys>>) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0);
  const idLen = body[20];
  const asPublic = body.slice(21, 21 + idLen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, ua.pair.privateKey, 256));
  const { cek, nonce } = await deriveKeys(shared, ua.auth, ua.pub, asPublic, salt);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, body.slice(21 + idLen)));
  return { rs, idLen, delimiter: plain[plain.length - 1], text: new TextDecoder().decode(plain.slice(0, -1)) };
}

describe("notifications: web push encryption (RFC 8291)", () => {
  it("encrypts so that the browser can read it", async () => {
    const ua = await browserKeys();
    const payload = JSON.stringify({ title: "Your week: €312.40", body: "12% less than the week before · Top: Food €96.10" });
    const out = await decrypt(await encryptPayload(payload, ua.sub), ua);
    expect(out).toEqual({ rs: 4096, idLen: 65, delimiter: 2, text: payload });
  });
  it("uses a fresh key and salt for every message", async () => {
    const ua = await browserKeys();
    const [a, b] = [await encryptPayload("hi", ua.sub), await encryptPayload("hi", ua.sub)];
    expect(b64urlEncode(a)).not.toBe(b64urlEncode(b));
  });
});

describe("notifications: VAPID (RFC 8292)", () => {
  it("signs a token the push service can verify with the public key", async () => {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
    const publicKey = b64urlEncode(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
    const privateKey = (await crypto.subtle.exportKey("jwk", pair.privateKey)).d!;
    const now = Date.UTC(2026, 9, 5, 7);
    const header = await vapidAuthorization("https://web.push.apple.com/QGuRz0abc", { publicKey, privateKey, subject: "https://flux-o.vercel.app" }, now);

    const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(publicKey);
    const [h, c, s] = token.split(".");
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h)))).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(c)))).toEqual({ aud: "https://web.push.apple.com", exp: now / 1000 + 43200, sub: "https://flux-o.vercel.app" });
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, b64urlDecode(s), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });
});

describe("notifications: the Monday report", () => {
  it("finds local midnight, across time zones and daylight saving", () => {
    expect(localMidnight(2026, 9, 28, "Europe/Lisbon").toISOString()).toBe("2026-09-27T23:00:00.000Z");
    expect(localMidnight(2026, 10, 26, "Europe/Lisbon").toISOString()).toBe("2026-10-26T00:00:00.000Z"); // after DST ends
    expect(localMidnight(2026, 9, 28, "America/Sao_Paulo").toISOString()).toBe("2026-09-28T03:00:00.000Z");
    expect(localMidnight(2026, 9, 28, "Asia/Kolkata").toISOString()).toBe("2026-09-27T18:30:00.000Z");
  });

  it("is due on Monday from 9:00 local time", () => {
    expect(isReportDue(new Date("2026-10-05T08:00:00Z"), "Europe/Lisbon")).toBe(true); // 09:00 Lisbon
    expect(isReportDue(new Date("2026-10-05T07:00:00Z"), "Europe/Lisbon")).toBe(false); // 08:00
    expect(isReportDue(new Date("2026-10-04T08:00:00Z"), "Europe/Lisbon")).toBe(false); // Sunday
    expect(isReportDue(new Date("2026-10-05T08:00:00Z"), "America/Sao_Paulo")).toBe(false); // 05:00 there
    expect(isReportDue(new Date("2026-10-05T12:00:00Z"), "America/Sao_Paulo")).toBe(true);
  });

  it("covers the Monday–Sunday week before, in the user's time zone", () => {
    const w = reportWeek(new Date("2026-10-05T08:00:00Z"), "Europe/Lisbon");
    expect(w.key).toBe("2026-09-28");
    expect(w.start.toISOString()).toBe("2026-09-27T23:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-10-04T23:00:00.000Z");
    expect(w.prevStart.toISOString()).toBe("2026-09-20T23:00:00.000Z");
  });

  it("totals the main currency and names the top category", () => {
    const w = reportWeek(new Date("2026-10-05T08:00:00Z"), "Europe/Lisbon");
    const rows = [
      { amount: 60, category: "food", currency: "EUR", date: "2026-09-29T12:00:00Z" },
      { amount: "40.5", category: "c1", currency: null, date: "2026-10-04T22:30:00Z" }, // Sunday 23:30 Lisbon
      { amount: 99, category: "food", currency: "USD", date: "2026-09-30T12:00:00Z" }, // other currency
      { amount: 5, category: "food", currency: "EUR", date: "2026-10-04T23:30:00Z" }, // Monday 00:30: this week
      { amount: 200, category: "rent", currency: "EUR", date: "2026-09-22T12:00:00Z" }, // week before
    ];
    const t = weekTotals(rows, w, "EUR", [{ id: "c1", label: "Gym" }, { id: "x", label: "Eats", builtin_key: "food" }]);
    expect(t).toEqual({ total: 100.5, prevTotal: 200, count: 2, top: { label: "Eats", amount: 60 } });
    expect(weeklyMessage(t, "EUR")).toEqual({ title: "Your week: €100.50", body: "50% less than the week before · Top: Eats €60.00" });
  });

  it("says so when nothing was logged", () => {
    expect(weeklyMessage({ total: 0, prevTotal: 10, count: 0, top: null }, "EUR").title).toBe("Your week: nothing logged");
    expect(weeklyMessage({ total: 10, prevTotal: 0, count: 1, top: { label: "Food", amount: 10 } }, "USD").body).toBe("Nothing the week before · Top: Food $10.00");
  });

  it("falls back to UTC for an unknown time zone", () => {
    expect(safeTimeZone("Mars/Base")).toBe("UTC");
    expect(safeTimeZone(null)).toBe("UTC");
    expect(safeTimeZone("Europe/Lisbon")).toBe("Europe/Lisbon");
  });
});
