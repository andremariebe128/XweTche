// Client de l'API Xwé Tché (dossier server/). Même origine : le cookie de session part tout seul.
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function appel<T>(methode: string, chemin: string, corps?: unknown, formData?: FormData): Promise<T> {
  let rep: Response;
  try {
    rep = await fetch(`/api${chemin}`, {
      method: methode,
      credentials: "same-origin",
      headers: corps !== undefined ? { "content-type": "application/json" } : undefined,
      body: formData ?? (corps !== undefined ? JSON.stringify(corps) : undefined),
    });
  } catch {
    throw new ApiError(0, "Pas de connexion pour le moment. Vérifiez votre réseau puis réessayez.", "reseau");
  }
  const texte = await rep.text();
  let data: unknown = null;
  try {
    data = texte ? JSON.parse(texte) : null;
  } catch {
    // réponse non JSON (page d'erreur d'hébergeur, par exemple)
  }
  if (!rep.ok) {
    const d = data as { erreur?: string; code?: string } | null;
    throw new ApiError(rep.status, d?.erreur ?? "Un problème est survenu. Réessayez dans un instant.", d?.code);
  }
  return data as T;
}

export const api = {
  get: <T>(chemin: string) => appel<T>("GET", chemin),
  post: <T = { ok: true }>(chemin: string, corps: unknown = {}) => appel<T>("POST", chemin, corps),
  put: <T = { ok: true }>(chemin: string, corps: unknown = {}) => appel<T>("PUT", chemin, corps),
  patch: <T = { ok: true }>(chemin: string, corps: unknown = {}) => appel<T>("PATCH", chemin, corps),
  del: <T = { ok: true }>(chemin: string) => appel<T>("DELETE", chemin),
  // Envoi de fichier (photos, documents) : multipart, sans en-tête content-type (le navigateur le règle).
  envoyer: <T>(chemin: string, formData: FormData) => appel<T>("POST", chemin, undefined, formData),
};

// Message à afficher à la personne (déjà rédigé en français par l'API).
export function messageErreur(e: unknown) {
  return e instanceof ApiError ? e.message : "Un problème est survenu. Réessayez dans un instant.";
}
export const estNonConnecte = (e: unknown) => e instanceof ApiError && e.status === 401;

// ---------------------------------------------------------------- Photos : réduction avant envoi
// Les fonctions de l'hébergeur limitent les envois à ~4,5 Mo : on réduit à 2000 px de large en JPEG
// (reste au-dessus du minimum de 1280 px, 5.2) avant d'envoyer ; l'API produit ensuite le WebP.
export async function reduirePhoto(fichier: File, largeurMax = 2000): Promise<File> {
  if (!fichier.type.startsWith("image/") || fichier.size < 900_000) return fichier;
  try {
    const bmp = await createImageBitmap(fichier);
    const echelle = Math.min(1, largeurMax / bmp.width);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * echelle);
    c.height = Math.round(bmp.height * echelle);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], fichier.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : fichier;
  } catch {
    return fichier;
  }
}

export interface PhotoEnvoyee {
  cle: string;
  cleOriginale: string;
  largeur: number;
  hauteur: number;
  empreinte: string;
}
export async function envoyerPhoto(fichier: File, chemin = "/upload/photo"): Promise<PhotoEnvoyee> {
  const f = new FormData();
  f.append("fichier", await reduirePhoto(fichier));
  return api.envoyer<PhotoEnvoyee>(chemin, f);
}
export async function envoyerDocument(fichier: File, type: string, consentement = false): Promise<{ id: string; type: string }> {
  const f = new FormData();
  f.append("fichier", fichier.type.startsWith("image/") ? await reduirePhoto(fichier) : fichier);
  f.append("type", type);
  if (consentement) f.append("consentement", "1");
  return api.envoyer("/upload/document", f);
}
