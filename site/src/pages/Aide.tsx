import { ChevronDown, MessageCircle, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Vide } from "../components/Vide";
import { THEMES } from "../data/aide";
import { useTitre } from "../lib/titre";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Aide() {
  useTitre("Aide");
  const [texte, setTexte] = useState("");
  const [theme, setTheme] = useState<string | null>(null);

  const t = norm(texte.trim());
  const themes = THEMES.filter((th) => !theme || th.id === theme)
    .map((th) => ({ ...th, questions: th.questions.filter((x) => !t || norm(`${x.q} ${x.r}`).includes(t)) }))
    .filter((th) => th.questions.length > 0);
  const total = themes.reduce((n, th) => n + th.questions.length, 0);

  return (
    <div className="wrap edito">
      <p className="eyebrow">Aide</p>
      <h1 className="h1">Comment pouvons-nous vous aider ?</h1>

      <div className="aide-recherche">
        <label htmlFor="aide-q" className="sr-only">
          Rechercher dans l'aide
        </label>
        <Search aria-hidden="true" />
        <input id="aide-q" type="search" placeholder="Visite, paiement, documents…" value={texte} onChange={(e) => setTexte(e.target.value)} />
      </div>

      <div className="pastilles aide-themes" role="group" aria-label="Thèmes">
        <button type="button" className="pastille" aria-pressed={!theme} onClick={() => setTheme(null)}>
          Tous les thèmes
        </button>
        {THEMES.map((th) => (
          <button key={th.id} type="button" className="pastille" aria-pressed={theme === th.id} onClick={() => setTheme(th.id)}>
            {th.titre}
          </button>
        ))}
      </div>

      <p className="petit gris" aria-live="polite">
        {total} question{total > 1 ? "s" : ""}
      </p>

      {total === 0 ? (
        <Vide
          titre="Aucune réponse trouvée"
          texte="Essayez avec un autre mot, ou posez directement votre question au support."
          action={
            <Link to="/contact" className="btn btn--principal">
              Contacter le support
            </Link>
          }
        />
      ) : (
        themes.map((th) => (
          <section key={th.id} className="aide-theme" aria-labelledby={`theme-${th.id}`}>
            <h2 id={`theme-${th.id}`} className="h3">
              {th.titre}
            </h2>
            <div className="accordeon">
              {th.questions.map((x) => (
                <details key={x.q} open={!!t}>
                  <summary>
                    {x.q}
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <p>{x.r}</p>
                </details>
              ))}
            </div>
          </section>
        ))
      )}

      <div className="encart aide-support">
        <div>
          <h2 className="h3">Vous n'avez pas trouvé ?</h2>
          <p>Notre équipe répond du lundi au samedi, de 8 h à 19 h [horaires à confirmer].</p>
        </div>
        <Link to="/contact" className="btn btn--secondaire">
          <MessageCircle size={18} aria-hidden="true" /> Contacter le support
        </Link>
      </div>
    </div>
  );
}
