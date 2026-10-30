import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { exigerUtilisateur } from "../auth.js";
import { db, un } from "../db.js";
import { erreur, post, type Ctx } from "../http.js";
import { ecrire } from "../storage.js";
import { param } from "../referentiel.js";

const MAX = 4 * 1024 * 1024; // limite des fonctions Vercel : 4,5 Mo par requête. Le site réduit les photos avant l'envoi.
const IMAGES = ["image/jpeg", "image/png", "image/webp"];
const DOCS = [...IMAGES, "application/pdf"];
const TYPES_DOC = ["cip", "passeport", "npi", "selfie", "titre_foncier", "attestation_detention", "convention_vente", "permis_habiter", "mandat"];
const IDENTITE = ["cip", "passeport", "npi", "selfie"];

async function fichierDe(req: Request, autorises: string[]) {
  let form: FormData;
  try { form = await req.formData(); } catch { throw erreur(400, "Le fichier n'a pas pu être lu. Réessayez."); }
  const f = form.get("fichier");
  if (!(f instanceof File)) throw erreur(422, "Aucun fichier reçu.");
  if (f.size > MAX) throw erreur(413, "Ce fichier est trop lourd (4 Mo maximum). Réduisez-le puis réessayez.");
  if (!autorises.includes(f.type)) throw erreur(415, "Format non accepté. Envoyez une photo JPG, PNG ou WebP" + (autorises.includes("application/pdf") ? ", ou un PDF." : "."));
  return { f, buf: Buffer.from(await f.arrayBuffer()), form };
}

// Empreinte perceptuelle « dHash » 64 bits : deux photos presque identiques ont des empreintes très proches (BO-04).
async function dHash(buf: Buffer) {
  const px = await sharp(buf).rotate().resize(9, 8, { fit: "fill" }).greyscale().raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

// Photo d'annonce : compressée en WebP pour le site, original gardé pour le contrôle (6.9).
export async function recevoirPhoto(c: Ctx, prefixe: string) {
  const { buf } = await fichierDe(c.req, IMAGES);
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try { meta = await sharp(buf).rotate().metadata(); } catch { throw erreur(422, "Cette image est illisible. Essayez avec une autre photo."); }
  const rot = meta.orientation && meta.orientation >= 5;
  const largeur = (rot ? meta.height : meta.width) ?? 0;
  const hauteur = (rot ? meta.width : meta.height) ?? 0;
  const id = randomUUID();
  const webp = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  const ext = meta.format === "png" ? "png" : meta.format === "webp" ? "webp" : "jpg";
  const cle = `${prefixe}/photos/${id}.webp`;
  const cleOriginale = `${prefixe}/originaux/${id}.${ext}`;
  await ecrire(cle, webp, "image/webp");
  await ecrire(cleOriginale, buf, `image/${meta.format ?? "jpeg"}`);
  return { cle, cleOriginale, largeur, hauteur, empreinte: await dHash(buf), min: await param("photo_largeur_min_px", 1280) };
}
post("/upload/photo", async (c) => recevoirPhoto(c, `u/${(await exigerUtilisateur(c)).id}`));

// Document d'identité ou de propriété : stocké en privé, jamais servi sans contrôle d'accès (15).
post("/upload/document", async (c) => {
  const u = await exigerUtilisateur(c);
  const { f, buf, form } = await fichierDe(c.req, DOCS);
  const type = String(form.get("type") ?? "");
  if (!TYPES_DOC.includes(type)) throw erreur(422, "Type de document inconnu.");
  if (IDENTITE.includes(type) && form.get("consentement") !== "1")
    throw erreur(422, "Nous avons besoin de votre accord pour conserver votre pièce d'identité.");
  const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1];
  const cle = `u/${u.id}/documents/${randomUUID()}.${ext}`;
  await ecrire(cle, buf, f.type);
  const d = await un<{ id: string }>(db,
    `INSERT INTO documents (utilisateur_id, type, fichier_cle, nom_origine, type_mime) VALUES ($1,$2::type_document,$3,$4,$5) RETURNING id`,
    [u.id, type, cle, f.name.slice(0, 120), f.type]);
  if (IDENTITE.includes(type))
    await db.query(
      `UPDATE utilisateurs SET consentement_identite_le = COALESCE(consentement_identite_le, now()),
              identite = CASE WHEN identite IN ('non_demandee','refusee') THEN 'en_attente' ELSE identite END WHERE id = $1`, [u.id]);
  return { id: d!.id, type };
});
