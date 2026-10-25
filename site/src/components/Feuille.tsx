import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

// Fenêtre (feuille sur mobile, boîte centrée sur ordinateur) : Échap, clic hors fenêtre et bouton pour fermer.
export function Feuille({
  titre,
  surtitre,
  soustitre,
  onFermer,
  children,
}: {
  titre: string;
  surtitre?: React.ReactNode;
  soustitre?: React.ReactNode;
  onFermer: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", echap);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", echap);
      document.body.style.overflow = "";
    };
  }, [onFermer]);

  return createPortal(
    <div className="voile" onClick={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="feuille" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} ref={ref}>
        <div className="feuille__tete">
          <div>
            {surtitre && <p className="etapes-ind">{surtitre}</p>}
            <h2 id={id} className="h3">
              {titre}
            </h2>
            {soustitre && (
              <p className="petit gris" style={{ margin: "4px 0 0" }}>
                {soustitre}
              </p>
            )}
          </div>
          <button type="button" className="btn-icone" aria-label="Fermer" onClick={onFermer}>
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
