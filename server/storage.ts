import { get as lireBlob, put } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { config } from "./config.js";

// Stockage objet. Sur Vercel : Vercel Blob (store PRIVÉ : aucune URL publique, tout passe par l'API).
// En local sans BLOB_READ_WRITE_TOKEN : dossier .stockage/ (développement uniquement).
const LOCAL = join(process.cwd(), ".stockage");

export async function ecrire(cle: string, donnees: Buffer, typeMime: string) {
  if (config.blobConfigured) {
    await put(cle, donnees, { access: "private", contentType: typeMime, addRandomSuffix: false, allowOverwrite: false });
    return;
  }
  if (config.production) throw new Error("Stockage non configuré (BLOB_READ_WRITE_TOKEN)");
  const f = join(LOCAL, cle);
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, donnees);
}

export async function lire(cle: string): Promise<{ corps: ReadableStream | Buffer; typeMime: string } | null> {
  if (config.blobConfigured) {
    const r = await lireBlob(cle, { access: "private" });
    if (!r || r.statusCode !== 200) return null;
    return { corps: r.stream as ReadableStream, typeMime: r.blob.contentType };
  }
  try {
    const buf = await readFile(join(LOCAL, cle));
    return { corps: buf, typeMime: cle.endsWith(".webp") ? "image/webp" : cle.endsWith(".pdf") ? "application/pdf" : "application/octet-stream" };
  } catch {
    return null;
  }
}
