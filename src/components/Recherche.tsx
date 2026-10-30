import { MapPin, Search } from "lucide-react";
import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuartiers } from "../lib/annonces";

// Barre de recherche : suggestions de quartiers dès la 2e lettre (6.5).
export function Recherche({ initial = "", compacte = false }: { initial?: string; compacte?: boolean }) {
  const [texte, setTexte] = useState(initial);
  const [ouvert, setOuvert] = useState(false);
  const navigate = useNavigate();
  const noms = (useQuartiers().donnees ?? []).map((q) => q.nom);
  const id = useId();

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const suggestions = texte.trim().length >= 2 ? noms.filter((q) => norm(q).includes(norm(texte.trim()))).slice(0, 6) : [];

  function chercher(q: string) {
    setOuvert(false);
    navigate(q.trim() ? `/louer?q=${encodeURIComponent(q.trim())}` : "/louer");
  }

  return (
    <form
      className={`recherche${compacte ? " recherche--compacte" : ""}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        chercher(texte);
      }}
    >
      <label htmlFor={id} className={compacte ? "sr-only" : "recherche__label"}>
        Où cherchez-vous ?
      </label>
      <div className="recherche__ligne">
        <div className="recherche__champ">
          <MapPin aria-hidden="true" />
          <input
            id={id}
            type="search"
            value={texte}
            autoComplete="off"
            placeholder="Quartier, ville ou repère"
            onChange={(e) => {
              setTexte(e.target.value);
              setOuvert(true);
            }}
            onBlur={() => setTimeout(() => setOuvert(false), 150)}
            aria-autocomplete="list"
            aria-controls={`${id}-liste`}
            aria-expanded={ouvert && suggestions.length > 0}
          />
        </div>
        <button type="submit" className="btn btn--principal recherche__bouton">
          <Search aria-hidden="true" size={20} />
          <span>Rechercher</span>
        </button>
      </div>
      {ouvert && suggestions.length > 0 && (
        <ul id={`${id}-liste`} className="recherche__suggestions" role="listbox">
          {suggestions.map((q) => (
            <li key={q} role="option" aria-selected="false">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTexte(q);
                  chercher(q);
                }}
              >
                <MapPin aria-hidden="true" />
                {q}
                <span className="gris"> · Cotonou</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
