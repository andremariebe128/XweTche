import { Link } from "react-router-dom";
import { Porte } from "../components/Marque";
import { useTitre } from "../lib/titre";

export default function APropos() {
  useTitre("À propos");
  return (
    <div className="wrap edito">
      <div className="apropos__tete">
        <div>
          <p className="eyebrow">À propos</p>
          <h1 className="h1">Xwé Tché, « ma maison » en fon</h1>
          <p className="lede">
            Ce qu'on cherche en louant, ce n'est pas un bien : c'est un chez-soi. Notre nom parle de cela, et notre symbole aussi : une porte
            entrouverte, et la lumière de la maison qui passe.
          </p>
          <p className="petit gris">[Orthographe et sens à confirmer par un locuteur fon.]</p>
        </div>
        <Porte taille={120} anime className="apropos__porte" />
      </div>

      <section className="apropos__bloc">
        <h2 className="h2">Pourquoi Xwé Tché existe</h2>
        <p>
          À Cotonou, chercher un logement, c'est souvent payer des visites sans résultat, tomber sur des annonces déjà louées ou des photos
          trompeuses, et découvrir les vrais montants au dernier moment. Les litiges sur les avances et les cautions sont fréquents.
        </p>
        <p>
          Nous voulons que chaque porte qui s'ouvre sur Xwé Tché mène à un logement réel, contrôlé, au prix annoncé.
        </p>
      </section>

      <section className="apropos__bloc">
        <h2 className="h2">Notre mission</h2>
        <div className="edito__grille edito__grille--3" style={{ marginTop: "var(--s5)" }}>
          {[
            ["Pour les locataires", "Des annonces fiables, vérifiées sur le terrain, des visites sans risque et un coût total connu d'avance."],
            ["Pour les propriétaires", "Une mise en location rapide, des candidats qui ont déjà vu le bien, et bientôt le suivi des loyers."],
            ["Pour la confiance", "Zéro fausse annonce publiée. Des preuves plutôt que des promesses : la date du contrôle, l'agent, la référence."],
          ].map(([t, p]) => (
            <div key={t} className="carte edito-carte">
              <h3 className="h3">{t}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="apropos__bloc">
        <h2 className="h2">L'équipe</h2>
        <p>
          Une équipe basée à Cotonou : agents d'étude, agents terrain, support client et finance. [Présentation de l'équipe, photos et noms à
          fournir, avec l'accord écrit de chaque personne photographiée.]
        </p>
        <div className="equipe">
          {["Responsable de l'agence", "Responsable d'étude", "Agents terrain", "Support client"].map((r) => (
            <div key={r} className="equipe__membre">
              <div className="equipe__photo" aria-hidden="true" />
              <strong>[Nom]</strong>
              <span className="petit gris">{r}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="apropos__actions">
        <Link to="/louer" className="btn btn--principal">
          Voir les logements
        </Link>
        <Link to="/contact" className="btn btn--secondaire">
          Nous contacter
        </Link>
      </div>
    </div>
  );
}
