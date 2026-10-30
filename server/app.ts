import { verifierConfig } from "./config.js";
import { json, repondre } from "./http.js";
import "./routes/public.js";
import "./routes/auth.js";
import "./routes/moi.js";
import "./routes/proprietaire.js";
import "./routes/upload.js";
import "./routes/agence.js";
import "./routes/agence-actions.js";
import "./routes/systeme.js";

export async function gerer(req: Request): Promise<Response> {
  const problemes = verifierConfig();
  if (problemes.length) {
    console.error("[api] configuration incomplète :", problemes.join(" ; "));
    return json({ erreur: "Le service n'est pas encore configuré.", details: problemes }, { status: 503 });
  }
  const r = await repondre(req);
  r.headers.set("x-content-type-options", "nosniff");
  r.headers.set("referrer-policy", "same-origin");
  return r;
}
