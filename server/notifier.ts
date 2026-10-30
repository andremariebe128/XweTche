import { db, un, type Requetable } from "./db.js";
import { envoyer, type Canal } from "./sms.js";

export function rendre(texte: string, vars: Record<string, string | number | undefined>) {
  return texte.replace(/\{(\w+)\}/g, (tout, k: string) => (vars[k] === undefined ? tout : String(vars[k])));
}

interface Envoi {
  modele: string;
  tel?: string | null;
  utilisateurId?: string | null;
  membreId?: string | null;
  vars: Record<string, string | number | undefined>;
  dedup?: string;
  planifieLe?: Date;
  canal?: Canal;
}

// Met le message en file puis tente l'envoi tout de suite ; en cas d'échec, le cron réessaie.
export async function notifier(e: Envoi, q: Requetable = db): Promise<void> {
  const m = await un<{ canal: Canal; texte: string }>(q, "SELECT canal, texte FROM modeles_message WHERE id = $1", [e.modele]);
  if (!m) return;
  const canal = e.canal ?? m.canal;
  const texte = rendre(m.texte, e.vars);
  const ligne = await un<{ id: string }>(
    q,
    `INSERT INTO notifications (utilisateur_id, membre_id, tel, canal, modele_id, contenu, planifie_le, cle_dedup)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (cle_dedup) DO NOTHING RETURNING id`,
    [e.utilisateurId ?? null, e.membreId ?? null, e.tel ?? null, canal, e.modele, texte, e.planifieLe ?? new Date(), e.dedup ?? null],
  );
  if (ligne && (!e.planifieLe || e.planifieLe <= new Date())) await expedier(ligne.id).catch(() => {});
}

export async function expedier(id: string) {
  const n = await un<{ canal: Canal; tel: string | null; contenu: string; statut: string }>(
    db, "SELECT canal, tel, contenu, statut FROM notifications WHERE id = $1", [id]);
  if (!n || n.statut === "envoye") return;
  try {
    await envoyer({ canal: n.canal, tel: n.tel, texte: n.contenu });
    await db.query("UPDATE notifications SET statut='envoye', envoye_le=now(), erreur=NULL WHERE id=$1", [id]);
  } catch (err) {
    await db.query("UPDATE notifications SET statut='echec', erreur=$2 WHERE id=$1", [id, String((err as Error).message).slice(0, 300)]);
  }
}
