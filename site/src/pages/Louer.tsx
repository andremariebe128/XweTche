import { Bell, List, Map as MapIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CarteAnnonce } from "../components/CarteAnnonce";
import { EQUIPEMENTS } from "../components/Equipements";
import { FondCarte } from "../components/PlanQuartier";
import { Recherche } from "../components/Recherche";
import { Vide } from "../components/Vide";
import { ANNONCES, TYPES, quartierDepuisSlug, type Equipement, type TypeBien } from "../data/annonces";
import { fcfa } from "../lib/format";
import { useTitre } from "../lib/titre";

const FILTRES_EQUIP: Equipement[] = ["meuble", "eau", "electricite", "cloture", "parking-voiture", "parking-moto", "climatisation"];
const BUDGETS = [
  ["", "Tout budget"],
  ["30000", "Jusqu'à 30 000 FCFA"],
  ["60000", "Jusqu'à 60 000 FCFA"],
  ["100000", "Jusqu'à 100 000 FCFA"],
  ["200000", "Jusqu'à 200 000 FCFA"],
] as const;

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Louer() {
  const { quartier: slugQ } = useParams();
  const quartierPage = slugQ ? quartierDepuisSlug(slugQ) : undefined;
  const [params, setParams] = useSearchParams();
  const [vue, setVue] = useState<"liste" | "carte">("liste");

  const q = params.get("q") ?? "";
  const type = params.get("type") as TypeBien | null;
  const budget = Number(params.get("budget") ?? 0);
  const equipBrut = params.get("equip") ?? "";
  const equip = useMemo(() => equipBrut.split(",").filter(Boolean) as Equipement[], [equipBrut]);
  const tri = params.get("tri") ?? "recentes";

  useTitre(quartierPage ? `Louer à ${quartierPage}, Cotonou` : "Logements à louer à Cotonou");

  function maj(cle: string, valeur: string | null) {
    const p = new URLSearchParams(params);
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    setParams(p, { replace: true });
  }

  const resultats = useMemo(() => {
    const liste = ANNONCES.filter((a) => {
      if (quartierPage && a.quartier !== quartierPage) return false;
      if (q) {
        const t = norm(q);
        const cible = norm([a.quartier, a.ville, a.titre, TYPES[a.type], ...a.reperes].join(" "));
        if (!cible.includes(t)) return false;
      }
      if (type && a.type !== type) return false;
      if (budget && a.loyer > budget) return false;
      if (equip.some((e) => !a.equipements.includes(e))) return false;
      return true;
    });
    return liste.sort((a, b) => (tri === "prix" ? a.loyer - b.loyer : tri === "prix-desc" ? b.loyer - a.loyer : a.publieeIlYa - b.publieeIlYa));
  }, [quartierPage, q, type, budget, equip, tri]);

  const lieu = quartierPage ?? (q || "Cotonou");
  const prixQuartier = quartierPage ? ANNONCES.filter((a) => a.quartier === quartierPage).map((a) => a.loyer) : [];

  return (
    <>
      <div className="wrap page-tete">
        {quartierPage && (
          <p className="fil">
            <Link to="/louer">Louer</Link> › Cotonou › {quartierPage}
          </p>
        )}
        <h1 className="h1">{quartierPage ? `Louer à ${quartierPage}` : q ? `Logements à louer : ${q}` : "Logements à louer à Cotonou"}</h1>
        {quartierPage && prixQuartier.length > 0 && (
          <div className="quartier-intro">
            <dl>
              <div>
                <dt>Annonces vérifiées</dt>
                <dd>{prixQuartier.length}</dd>
              </div>
              <div>
                <dt>Loyers observés</dt>
                <dd>
                  {fcfa(Math.min(...prixQuartier))} à {fcfa(Math.max(...prixQuartier))}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <div className="filtres">
        <div className="wrap">
          {!quartierPage && (
            <div className="filtres__ligne">
              <Recherche initial={q} compacte />
            </div>
          )}
          <div className="pastilles" role="group" aria-label="Filtres">
            <select
              className="filtres__budget"
              aria-label="Type de logement"
              value={type ?? ""}
              onChange={(e) => maj("type", e.target.value || null)}
            >
              <option value="">Tous les types</option>
              {Object.entries(TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select className="filtres__budget" aria-label="Budget maximum" value={budget || ""} onChange={(e) => maj("budget", e.target.value || null)}>
              {BUDGETS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {FILTRES_EQUIP.map((e) => {
              const { libelle, Icone } = EQUIPEMENTS[e];
              const actif = equip.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  className="pastille"
                  aria-pressed={actif}
                  onClick={() => maj("equip", (actif ? equip.filter((x) => x !== e) : [...equip, e]).join(",") || null)}
                >
                  <Icone aria-hidden="true" />
                  {libelle.replace(" au compteur", "")}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingBottom: "var(--s8)" }}>
        <div className="resultats__barre">
          <p aria-live="polite">
            {resultats.length} logement{resultats.length > 1 ? "s" : ""} vérifié{resultats.length > 1 ? "s" : ""} · {lieu}
          </p>
          <div className="resultats__outils">
            <button type="button" className="btn btn--texte">
              <Bell size={18} aria-hidden="true" /> Être alerté
            </button>
            <select className="tri" aria-label="Trier" value={tri} onChange={(e) => maj("tri", e.target.value === "recentes" ? null : e.target.value)}>
              <option value="recentes">Plus récentes</option>
              <option value="prix">Prix croissant</option>
              <option value="prix-desc">Prix décroissant</option>
            </select>
            <div className="bascule" role="group" aria-label="Affichage">
              <button type="button" aria-pressed={vue === "liste"} onClick={() => setVue("liste")}>
                <List aria-hidden="true" /> Liste
              </button>
              <button type="button" aria-pressed={vue === "carte"} onClick={() => setVue("carte")}>
                <MapIcon aria-hidden="true" /> Carte
              </button>
            </div>
          </div>
        </div>

        {resultats.length === 0 ? (
          <Vide
            titre={`Aucune annonce pour le moment${quartierPage || q ? ` à ${lieu}` : ""}`}
            texte="Nos agents vérifient de nouveaux logements chaque semaine. Soyez prévenu par SMS dès qu'il y en a un."
            action={
              <button type="button" className="btn btn--principal">
                <Bell size={18} aria-hidden="true" /> Être alerté
              </button>
            }
          />
        ) : vue === "liste" ? (
          <div className="grille-annonces">
            {resultats.map((a, i) => (
              <CarteAnnonce key={a.ref} annonce={a} index={i} />
            ))}
          </div>
        ) : (
          <div className="carte-zone">
            <FondCarte />
            {resultats.map((a, i) => (
              <Link
                key={a.ref}
                to={`/annonce/${a.slug}`}
                className="carte-zone__point"
                style={{ left: `${12 + ((i * 37) % 76)}%`, top: `${18 + ((i * 23) % 64)}%` }}
              >
                {fcfa(a.loyer)}
              </Link>
            ))}
            <span className="carte-zone__note mono gris">Positions approximatives · carte d'exemple</span>
          </div>
        )}
      </div>
    </>
  );
}
