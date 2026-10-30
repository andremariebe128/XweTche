import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const jetonAleatoire = (octets = 32) => randomBytes(octets).toString("base64url");
export const codeOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const hmac = (s: string) => createHmac("sha256", config.secret).update(s).digest("hex");

export function egal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Jeton court signé (preuve qu'un numéro a été vérifié par OTP, avant création du compte)
export function signer(charge: object, validiteSec: number) {
  const corps = Buffer.from(JSON.stringify({ ...charge, exp: Math.floor(Date.now() / 1000) + validiteSec })).toString("base64url");
  return `${corps}.${hmac(corps)}`;
}
export function verifierSignature<T>(jeton: string): (T & { exp: number }) | null {
  const [corps, sig] = jeton.split(".");
  if (!corps || !sig || !egal(sig, hmac(corps))) return null;
  try {
    const c = JSON.parse(Buffer.from(corps, "base64url").toString());
    return c.exp > Date.now() / 1000 ? c : null;
  } catch {
    return null;
  }
}
