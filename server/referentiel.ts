import { db, type Requetable } from "./db.js";

// Libellés et conversions partagés entre les routes (mêmes valeurs que le front : src/data/annonces.ts).
export const TYPES: Record<string, string> = {
  "entree-couchee": "Entrée-couchée", "chambre-salon": "Chambre-salon", studio: "Studio",
  appartement: "Appartement", maison: "Maison", boutique: "Boutique",
};
export const OPERATEURS: Record<string, string> = {
  mtn_momo: "MTN MoMo", moov_money: "Moov Money", celtiis_cash: "Celtiis Cash", carte: "Carte bancaire", especes: "Espèces",
};
export const OPERATEUR_CODE: Record<string, string> = {
  "MTN MoMo": "mtn_momo", "Moov Money": "moov_money", "Celtiis Cash": "celtiis_cash",
};

export function slugifier(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
export const tiret = (s: string) => s.replace(/_/g, "-");
export const sousTiret = (s: string) => s.replace(/-/g, "_");

export async function param<T = number>(cle: string, defaut: T, q: Requetable = db): Promise<T> {
  const r = await q.query<{ valeur: T }>("SELECT valeur FROM parametres WHERE cle = $1", [cle]);
  return r.rows[0] ? r.rows[0].valeur : defaut;
}

// Format JJ/MM utilisé par le front pour « Vérifié le 12/11 » et « Bientôt disponible le 12/03 »
export function jjmm(d: Date | string | null | undefined) {
  if (!d) return undefined;
  const x = typeof d === "string" ? new Date(d) : d;
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : undefined);

export function prenomInitiale(nom: string) {
  const [p, ...reste] = nom.trim().split(/\s+/);
  return reste.length ? `${p} ${reste[reste.length - 1][0].toUpperCase()}.` : p;
}

export async function genererSlug(ref: string, type: string, quartier: string, q: Requetable = db) {
  const base = `${ref.toLowerCase()}-${slugifier(type)}-${slugifier(quartier)}`;
  const r = await q.query("SELECT 1 FROM annonces WHERE slug = $1", [base]);
  return r.rows.length ? `${base}-${Math.random().toString(36).slice(2, 6)}` : base;
}
