import { config } from "./config.js";

export type Canal = "sms" | "whatsapp" | "email" | "push";

// Un seul point d'envoi. Le choix de l'agrégateur SMS/WhatsApp est encore ouvert (cahier des charges, point 9) :
//  - « console » : écrit le message dans les journaux (développement)
//  - « http »    : POST JSON {to, from, text, channel} avec Bearer SMS_API_KEY. À adapter au format exact
//                  de l'agrégateur retenu (une quinzaine de lignes, ici).
export async function envoyer(p: { canal: Canal; tel?: string | null; email?: string | null; texte: string }) {
  if (p.canal === "push") throw new Error("Notifications push non configurées");
  if (p.canal === "email") throw new Error("E-mail non configuré");
  if (!p.tel) throw new Error("Aucun numéro de destinataire");
  if (config.smsProvider === "console") {
    console.log(`[${p.canal}] → ${p.tel} : ${p.texte}`);
    return;
  }
  if (!config.smsApiUrl) throw new Error("SMS_API_URL manquant");
  const rep = await fetch(config.smsApiUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.smsApiKey}` },
    body: JSON.stringify({ to: `229${p.tel.replace(/^0/, "")}`, from: config.smsSender, text: p.texte, channel: p.canal }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!rep.ok) throw new Error(`Fournisseur SMS : HTTP ${rep.status}`);
}
