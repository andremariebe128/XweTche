import { Bell } from "lucide-react";
import { useState } from "react";
import { TYPES, type Annonce, type TypeBien } from "../data/annonces";
import { api, messageErreur } from "../lib/api";
import { rafraichirEtat, useEtat } from "../lib/compte";
import { fcfa } from "../lib/format";
import { useParametres } from "../lib/parametres";
import { Feuille } from "./Feuille";
import { Porte } from "./Marque";

type Canal = "sms" | "whatsapp";

// « Être alerté » : alerte sur une recherche (LOC-04) ou liste d'attente d'un bien loué (LOC-12).
export function Alerte({
  annonce,
  quartier = "",
  type,
  budget,
  onFermer,
}: {
  annonce?: Annonce;
  quartier?: string;
  type?: TypeBien | null;
  budget?: number;
  onFermer: () => void;
}) {
  const [q, setQ] = useState(quartier);
  const [t, setT] = useState<string>(type ?? "");
  const [b, setB] = useState(budget ? String(budget) : "");
  const { compte } = useEtat();
  const { quartiers } = useParametres();
  const [tel, setTel] = useState(compte?.tel ?? "");
  const [canal, setCanal] = useState<Canal>("sms");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const telValide = tel.replace(/\D/g, "").length >= 8;

  if (envoye)
    return (
      <Feuille titre={annonce ? "Vous êtes sur la liste d'attente" : "Alerte enregistrée"} onFermer={onFermer}>
        <div className="confirmation">
          <Porte taille={40} anime />
          <p className="gris">
            {annonce
              ? `Vous recevrez un ${canal === "sms" ? "SMS" : "message WhatsApp"} dès que ce logement se libère${annonce.disponibleLe ? `, prévu le ${annonce.disponibleLe}` : ""}.`
              : `Vous recevrez un ${canal === "sms" ? "SMS" : "message WhatsApp"} dès qu'une annonce vérifiée correspond à votre recherche.`}
          </p>
          <div className="recap">
            <strong>{annonce ? `${TYPES[annonce.type]} · ${annonce.quartier}` : resume(q, t, b)}</strong>
            {annonce && <span className="mono gris">Réf. {annonce.ref}</span>}
          </div>
          <p className="petit gris">Vous pouvez arrêter les alertes à tout moment en répondant STOP.</p>
          <button type="button" className="btn btn--secondaire btn--bloc" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </Feuille>
    );

  return (
    <Feuille
      titre={annonce ? "Être alerté quand il se libère" : "Être alerté des nouvelles annonces"}
      soustitre={
        annonce ? (
          <>
            {TYPES[annonce.type]} · {annonce.quartier} · <span className="mono">Réf. {annonce.ref}</span>
          </>
        ) : (
          "Nous vous prévenons dès qu'un logement vérifié correspond."
        )
      }
      onFermer={onFermer}
    >
      <form
        className="formulaire"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!telValide || enCours) return;
          setEnCours(true);
          setErreur(null);
          try {
            if (!compte) throw new Error("connexion");
            if (annonce) await api.post(`/annonces/${annonce.ref}/attente`, { canal });
            else await api.post("/alertes", { quartier: q || undefined, type: t || undefined, budget: b ? Number(b) : undefined, canal, tel });
            await rafraichirEtat();
            setEnvoye(true);
          } catch (er) {
            setErreur(er instanceof Error && er.message === "connexion" ? "Connectez-vous pour créer une alerte." : messageErreur(er));
          } finally {
            setEnCours(false);
          }
        }}
      >
        {!annonce && (
          <>
            <div className="champ">
              <label htmlFor="alerte-q">Quartier</label>
              <select id="alerte-q" value={q} onChange={(e) => setQ(e.target.value)}>
                <option value="">Tout Cotonou</option>
                {quartiers.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div className="formulaire__deux">
              <div className="champ">
                <label htmlFor="alerte-t">Type de logement</label>
                <select id="alerte-t" value={t} onChange={(e) => setT(e.target.value)}>
                  <option value="">Tous les types</option>
                  {Object.entries(TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="champ">
                <label htmlFor="alerte-b">Loyer maximum</label>
                <select id="alerte-b" value={b} onChange={(e) => setB(e.target.value)}>
                  <option value="">Tout budget</option>
                  {[30000, 60000, 100000, 200000].map((x) => (
                    <option key={x} value={x}>
                      {fcfa(x)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
        <div className="champ">
          <label htmlFor="alerte-tel">Numéro de téléphone</label>
          <input id="alerte-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="01 97 00 00 00" value={tel} onChange={(e) => setTel(e.target.value)} />
        </div>
        <fieldset className="champ champ--groupe">
          <legend>Recevoir l'alerte par</legend>
          <div className="bascule">
            <button type="button" aria-pressed={canal === "sms"} onClick={() => setCanal("sms")}>
              SMS
            </button>
            <button type="button" aria-pressed={canal === "whatsapp"} onClick={() => setCanal("whatsapp")}>
              WhatsApp
            </button>
          </div>
        </fieldset>
        {erreur && <div className="bandeau bandeau--erreur" role="alert">{erreur}</div>}
        <button type="submit" className="btn btn--principal btn--bloc" disabled={!telValide || enCours}>
          <Bell size={18} aria-hidden="true" /> {annonce ? "M'inscrire sur la liste d'attente" : "Créer l'alerte"}
        </button>
      </form>
    </Feuille>
  );
}

function resume(q: string, t: string, b: string) {
  return [t ? TYPES[t as TypeBien] : "Tous les logements", q || "Cotonou", b ? `jusqu'à ${fcfa(Number(b))}` : ""].filter(Boolean).join(" · ");
}
