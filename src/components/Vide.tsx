import { Porte } from "./Marque";

// État vide : la porte, une phrase utile et une action (6.5).
export function Vide({ titre, texte, action }: { titre: string; texte: string; action?: React.ReactNode }) {
  return (
    <div className="vide">
      <Porte taille={36} />
      <h2 className="h3">{titre}</h2>
      <p className="gris">{texte}</p>
      {action}
    </div>
  );
}
