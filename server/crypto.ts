import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config.js";

const scryptAsync = promisify(scrypt) as (mdp: string, sel: string, taille: number) => Promise<Buffer>;

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const jetonAleatoire = (octets = 32) => randomBytes(octets).toString("base64url");
export const hmac = (s: string) => createHmac("sha256", config.secret).update(s).digest("hex");

export function egal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Mots de passe : scrypt + sel aléatoire. Format stocké : scrypt$<sel hex>$<empreinte hex>.
// Jamais de mot de passe en clair, ni de comparaison directe de chaînes.
export async function hacherMotDePasse(mdp: string) {
  const sel = randomBytes(16).toString("hex");
  const empreinte = await scryptAsync(mdp, sel, 64);
  return `scrypt$${sel}$${empreinte.toString("hex")}`;
}

export async function verifierMotDePasse(mdp: string, hash: string | null | undefined) {
  if (!hash) return false;
  const [algo, sel, attendu] = hash.split("$");
  if (algo !== "scrypt" || !sel || !attendu) return false;
  const calc = await scryptAsync(mdp, sel, 64);
  const ref = Buffer.from(attendu, "hex");
  return calc.length === ref.length && timingSafeEqual(calc, ref);
}
