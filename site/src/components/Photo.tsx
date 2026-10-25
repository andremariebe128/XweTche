import { Camera } from "lucide-react";

// Emplacement de photo en attendant les vraies photos de contrôle (format 4:3, 6.5).
const TEINTES = ["#e9eef0", "#eef0ec", "#efece8", "#e8ecef", "#ecebef"];

export function Photo({
  libelle,
  graine = 0,
  ratio = "4 / 3",
  children,
  className,
}: {
  libelle: string;
  graine?: number;
  ratio?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`photo${className ? ` ${className}` : ""}`}
      style={{ aspectRatio: ratio, background: TEINTES[graine % TEINTES.length] }}
      role="img"
      aria-label={libelle}
    >
      <span className="photo__libelle">
        <Camera aria-hidden="true" />
        {libelle}
      </span>
      {children}
    </div>
  );
}
