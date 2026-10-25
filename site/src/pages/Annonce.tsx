import { Bell, ChevronLeft, ChevronRight, Flag, Heart, MapPin, Share2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CoutTotal } from "../components/CoutTotal";
import { EQUIPEMENTS } from "../components/Equipements";
import { Photo } from "../components/Photo";
import { FondCarte } from "../components/PlanQuartier";
import { Reservation } from "../components/Reservation";
import { BadgeAnnonce } from "../components/Statut";
import { ANNONCES, TYPES, slugQuartier, totalEntree } from "../data/annonces";
import { useFavoris } from "../lib/favoris";
import { fcfa } from "../lib/format";
import { useTitre } from "../lib/titre";
import Introuvable from "./Introuvable";

export default function Annonce() {
  const { slug } = useParams();
  const annonce = ANNONCES.find((a) => a.slug === slug);
  const { estFavori, basculer } = useFavoris();
  const [photo, setPhoto] = useState(0);
  const [reserver, setReserver] = useState(false);

  useTitre(annonce ? `${TYPES[annonce.type]} à ${annonce.quartier}, ${fcfa(annonce.loyer)}` : "Annonce introuvable");

  if (!annonce) return <Introuvable />;

  const loue = annonce.statut !== "en-ligne";
  const favori = estFavori(annonce.ref);
  const n = annonce.photos.length;
  const action = loue ? (
    <button type="button" className="btn btn--principal btn--bloc">
      <Bell size={18} aria-hidden="true" /> Être alerté
    </button>
  ) : (
    <button type="button" className="btn btn--principal btn--bloc" onClick={() => setReserver(true)}>
      Réserver une visite
    </button>
  );
  const partage = `https://wa.me/?text=${encodeURIComponent(
    `${TYPES[annonce.type]} à ${annonce.quartier}, ${fcfa(annonce.loyer)} / mois, vérifié sur place par Xwé Tché : ${location.href}`,
  )}`;

  return (
    <div className="fiche">
      <div className="wrap">
        <p className="fil">
          <Link to="/louer">Louer</Link> › <Link to={`/louer/cotonou/${slugQuartier(annonce.quartier)}`}>{annonce.quartier}</Link> ›{" "}
          <span className="mono">Réf. {annonce.ref}</span>
        </p>

        {/* 1. Galerie */}
        <div className="galerie-grille">
          <div className="galerie">
            <Photo
              libelle={`Photo ${photo + 1} sur ${n}, ${annonce.photos[photo].toLowerCase()}`}
              graine={photo}
              ratio="4 / 3"
            />
            <span className="galerie__badge">
              <BadgeAnnonce annonce={annonce} surPhoto avecDate />
            </span>
            <span className="galerie__compteur">
              {photo + 1} / {n}
            </span>
            <button type="button" className="galerie__nav galerie__nav--g" aria-label="Photo précédente" onClick={() => setPhoto((p) => (p - 1 + n) % n)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="galerie__nav galerie__nav--d" aria-label="Photo suivante" onClick={() => setPhoto((p) => (p + 1) % n)}>
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
          <div className="galerie__vignettes">
            {[1, 2].map((d) => {
              const i = (photo + d) % n;
              return (
                <button key={d} type="button" onClick={() => setPhoto(i)} aria-label={`Voir la photo ${i + 1}`}>
                  <Photo libelle={annonce.photos[i]} graine={i} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="fiche__grille">
          <div>
            {/* 2. Type, quartier, loyer */}
            <div className="fiche__entete">
              <div>
                <h1 className="h2">
                  {TYPES[annonce.type]} à {annonce.quartier}
                </h1>
                <p className="fiche__sous">
                  {annonce.titre}
                  {annonce.surface ? ` · ${annonce.surface} m²` : ""}
                </p>
                <p className="prix">
                  {fcfa(annonce.loyer)} <small>/ mois</small>
                </p>
              </div>
              <div className="fiche__boutons">
                <button
                  type="button"
                  className="btn-icone"
                  aria-pressed={favori}
                  aria-label={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
                  onClick={() => basculer(annonce.ref)}
                >
                  <Heart aria-hidden="true" size={20} fill={favori ? "currentColor" : "none"} />
                </button>
                <a className="btn-icone" href={partage} target="_blank" rel="noreferrer" aria-label="Partager sur WhatsApp">
                  <Share2 aria-hidden="true" size={20} />
                </a>
              </div>
            </div>

            {/* 3. Coût total (mobile ; sur ordinateur il est dans la colonne de droite) */}
            <div className="bloc fiche__cout-mobile">
              <CoutTotal annonce={annonce} />
            </div>

            {/* 4. Équipements */}
            <section className="bloc">
              <h2 className="h3">Équipements</h2>
              <ul className="equip-liste">
                {annonce.equipements.map((e) => {
                  const { libelle, Icone } = EQUIPEMENTS[e];
                  return (
                    <li key={e}>
                      <Icone aria-hidden="true" /> {libelle}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* 5. Localisation */}
            <section className="bloc">
              <h2 className="h3">Localisation</h2>
              <div className="carte-approx" role="img" aria-label={`Zone approximative du logement à ${annonce.quartier}`}>
                <FondCarte />
                <span className="carte-approx__zone" />
              </div>
              <ul className="reperes">
                {annonce.reperes.map((r) => (
                  <li key={r}>
                    <MapPin aria-hidden="true" /> {r}
                  </li>
                ))}
              </ul>
              <p className="petit gris" style={{ marginTop: "var(--s3)" }}>
                L'adresse exacte vous est communiquée après la réservation de la visite.
              </p>
            </section>

            {/* 6. Description */}
            <section className="bloc">
              <h2 className="h3">Description</h2>
              <p>{annonce.description}</p>
              <ul className="regles">
                {annonce.regles.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="petit gris" style={{ marginTop: "var(--s3)" }}>
                {annonce.statut === "bientot"
                  ? `Disponible à partir du ${annonce.disponibleLe}.`
                  : annonce.statut === "reservee"
                    ? "Un candidat a été retenu, signature en cours."
                    : "Disponible immédiatement."}
              </p>
            </section>

            {/* 7. Confiance */}
            <section className="bloc">
              <div className="confiance-bloc">
                <p className="confiance-bloc__titre">
                  <ShieldCheck aria-hidden="true" /> Contrôlé sur place le {annonce.verifieLe}
                </p>
                <p>
                  Ce bien a été contrôlé sur place le {annonce.verifieLe} par {annonce.agent}, agent Xwé Tché : photos conformes, compteurs
                  vérifiés, documents du propriétaire acceptés. Les coordonnées du propriétaire vous sont données lors de la visite.
                </p>
                <div className="confiance-bloc__actions">
                  <Link to="/confiance" className="petit">
                    Comment nous vérifions un logement
                  </Link>
                  <button type="button" className="btn btn--texte signaler petit">
                    <Flag size={16} aria-hidden="true" /> Signaler cette annonce
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className="fiche__cote">
            <div className="carte fiche__cote-carte">
              <CoutTotal annonce={annonce} />
              {action}
              <p className="petit gris">{loue ? "Vous serez prévenu par SMS dès qu'il se libère." : "Rien à payer maintenant. Confirmation par SMS."}</p>
            </div>
          </aside>
        </div>
      </div>

      {/* 8. Bouton principal fixé en bas d'écran (mobile) */}
      <div className="barre-action">
        <div>
          <p className="prix">{fcfa(annonce.loyer)}</p>
          <p className="petit gris" style={{ margin: 0 }}>
            Entrée : {fcfa(totalEntree(annonce))}
          </p>
        </div>
        {action}
      </div>

      {reserver && <Reservation annonce={annonce} onFermer={() => setReserver(false)} />}
    </div>
  );
}
