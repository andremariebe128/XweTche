import { NavLink } from "react-router-dom";
import { DOCS_LEGAUX } from "../data/legal";
import { useTitre } from "../lib/titre";
import Introuvable from "./Introuvable";

export default function Legal({ slug }: { slug: string }) {
  const doc = DOCS_LEGAUX.find((d) => d.slug === slug);
  useTitre(doc?.titre ?? "Page introuvable");
  if (!doc) return <Introuvable />;

  return (
    <div className="wrap edito legal">
      <nav className="legal__nav" aria-label="Documents légaux">
        {DOCS_LEGAUX.map((d) => (
          <NavLink key={d.slug} to={`/${d.slug}`} className="legal__lien">
            {d.titre}
          </NavLink>
        ))}
      </nav>

      <article className="legal__doc">
        <p className="eyebrow">Informations légales</p>
        <h1 className="h1">{doc.titre}</h1>
        <p className="lede">{doc.intro}</p>
        <p className="mono gris legal__maj">Dernière mise à jour : [JJ/MM/AAAA]</p>

        <div className="bandeau bandeau--info legal__brouillon" role="note">
          Document en préparation. Le texte définitif sera rédigé et validé par un juriste avant le lancement. Seul le plan est présenté ici.
        </div>

        <ol className="legal__sections">
          {doc.sections.map((s, i) => (
            <li key={s.titre} id={`s${i + 1}`}>
              <h2 className="h3">
                <span className="mono">{String(i + 1).padStart(2, "0")}</span> {s.titre}
              </h2>
              <ul>
                {s.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="legal__a-rediger">[Texte à rédiger par le juriste]</p>
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}
