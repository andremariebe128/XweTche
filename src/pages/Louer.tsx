import { Bell, List, Map as MapIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Alerte } from "../components/Alerte";
import { CarteAnnonce } from "../components/CarteAnnonce";
import { EQUIPEMENTS } from "../components/Equipements";
import { FondCarte } from "../components/PlanQuartier";
import { Recherche } from "../components/Recherche";
import { Vide } from "../components/Vide";
import { TYPES, type Equipement, type TypeBien } from "../data/annonces";
import { useAnnonces, useQuartiers } from "../lib/annonces";
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
  const tousQuartiers = useQuartiers().donnees ?? [];
  const quartierPage = slugQ ? tousQuartiers.find((x) => x.slug === slugQ)?.nom : undefined;
  const [params, setParams] = useSearchParams();
  const [vue, setVue] = useState<"liste" | "carte">("liste");
  const [alerte, setAlerte] = useState(false);

  const q = params.get("q") ?? "";
  const type = params.get("type") as TypeBien | null;
  const budget = Number(params.get("budget") ?? 0);
  const equipBrut = params.get("equip") ?? "";
  const equip = useMemo(() => equipBrut.split(",").filter(Boolean) as Equipement[], [equipBrut]);
  const tri = params.get("tri") ?? "recentes";
  const page = Math.max(0, Number(params.get("page") ?? 0));
  const LIMITE = 24;

  useTitre(quartierPage ? `Louer à ${quartierPage}, Cotonou` : "Logements à louer à Cotonou");

  function maj(cle: string, valeur: string | null) {
    const p = new URLSearchParams(params);
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    if (cle !== "page") p.delete("page");
    setParams(p, { replace: true });
  }

  // Recherche libre : un nom de quartier connu devient un filtre serveur, sinon on filtre le texte sur la page reçue.
  const quartierSaisi = q ? tousQuartiers.find((x) => norm(x.nom) === norm(q)) : undefined;
  const { donnees, chargement, erreur } = useAnnonces({
    quartier: slugQ ?? quartierSaisi?.slug,
    type: type ?? undefined,
    budget: budget || undefined,
    equipements: equip,
    tri: tri === "prix" ? "prix_asc" : tri === "prix-desc" ? "prix_desc" : "recentes",
    page,
    limite: LIMITE,
  });
  const total = donnees?.total ?? 0;
  const resultats = useMemo(() => {
    const liste = donnees?.items ?? [];
    if (!q || quartierSaisi) return liste;
    const t = norm(q);
    return liste.filter((a) => norm([a.quartier, a.ville, a.titre, TYPES[a.type], ...a.reperes].join(" ")).includes(t));
  }, [donnees, q, quartierSaisi]);

  const lieu = quartierPage ?? (q || "Cotonou");
  const prixQuartier = quartierPage ? resultats.map((a) => a.loyer) : [];

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
                <dd>{total}</dd>
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
            {chargement ? "Recherche en cours…" : `${q && !quartierSaisi ? resultats.length : total} logement${(q && !quartierSaisi ? resultats.length : total) > 1 ? "s" : ""} vérifié${(q && !quartierSaisi ? resultats.length : total) > 1 ? "s" : ""} · ${lieu}`}
          </p>
          <div className="resultats__outils">
            <button type="button" className="btn btn--texte" onClick={() => setAlerte(true)}>
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

        {erreur ? (
          <div className="bandeau bandeau--erreur" role="alert">{erreur}</div>
        ) : chargement && !donnees ? (
          <div className="grille-annonces" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="carte squelette" style={{ minHeight: 280 }} />)}
          </div>
        ) : resultats.length === 0 ? (
          <Vide
            titre={`Aucune annonce pour le moment${quartierPage || q ? ` à ${lieu}` : ""}`}
            texte="Nos agents vérifient de nouveaux logements chaque semaine. Soyez prévenu par SMS dès qu'il y en a un."
            action={
              <button type="button" className="btn btn--principal" onClick={() => setAlerte(true)}>
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

      {total > LIMITE && (
        <nav className="wrap pagination" aria-label="Pages de résultats" style={{ display: "flex", gap: "var(--s3)", justifyContent: "center", paddingBottom: "var(--s8)" }}>
          <button type="button" className="btn btn--secondaire" disabled={page === 0} onClick={() => maj("page", page > 1 ? String(page - 1) : null)}>
            Précédent
          </button>
          <span className="gris" style={{ alignSelf: "center" }}>Page {page + 1} sur {Math.ceil(total / LIMITE)}</span>
          <button type="button" className="btn btn--secondaire" disabled={(page + 1) * LIMITE >= total} onClick={() => maj("page", String(page + 1))}>
            Suivant
          </button>
        </nav>
      )}

      {alerte && (
        <Alerte
          quartier={quartierPage ?? quartierSaisi?.nom ?? ""}
          type={type}
          budget={budget || undefined}
          onFermer={() => setAlerte(false)}
        />
      )}
    </>
  );
}
