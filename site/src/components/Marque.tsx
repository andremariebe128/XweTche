// Éléments de marque. Le logo est toujours le SVG du kit, jamais recomposé au clavier (6.1).

type VersionLogo = "couleur" | "negatif" | "sur-encre" | "noir" | "blanc" | "vertical";

export function Logo({ version = "couleur", largeur = 148 }: { version?: VersionLogo; largeur?: number }) {
  return (
    <img
      src={`/brand/xwe-tche-logo-${version}.svg`}
      alt="Xwé Tché"
      width={Math.max(largeur, 120)}
      height={Math.round((Math.max(largeur, 120) * 892) / 5692)}
    />
  );
}

/**
 * Le symbole de la porte. `ouverture` fait varier la lame de lumière (0 = fermée, 1 = comme le logo).
 * Réservé à la marque : chargement, états vides, moments de marque (6.7).
 */
export function Porte({
  taille = 40,
  battant = "var(--lagune)",
  anime = false,
  className,
}: {
  taille?: number;
  battant?: string;
  anime?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 60"
      width={taille}
      height={(taille * 60) / 40}
      aria-hidden="true"
      className={`porte${anime ? " porte--anime" : ""}${className ? ` ${className}` : ""}`}
    >
      <path className="porte__lumiere" d="M0 60 L6 60 L24 0 L0 0 Z" fill="var(--safran)" />
      <path className="porte__battant" d="M6 60 L40 60 L40 0 L24 0 Z" fill={battant} />
    </svg>
  );
}
