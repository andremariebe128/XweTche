// Fond de carte simplifié en attendant le choix du fournisseur de cartographie (chapitre 13).
export function FondCarte() {
  return (
    <svg className="fond" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="800" height="520" fill="#eef2f1" />
      <path d="M0 470 Q200 440 400 460 T800 450 L800 520 L0 520 Z" fill="#d4e6e8" />
      <path d="M560 0 Q600 160 540 260 T620 520 L800 520 L800 0 Z" fill="#dcebec" />
      <g stroke="#ffffff" strokeWidth="10" fill="none" strokeLinecap="round">
        <path d="M0 120 L800 160" />
        <path d="M0 300 Q300 280 520 320 T800 300" />
        <path d="M180 0 L240 520" />
        <path d="M420 0 Q400 250 460 520" />
      </g>
      <g stroke="#ffffff" strokeWidth="4" fill="none">
        <path d="M0 210 L540 230" />
        <path d="M90 0 L120 520" />
        <path d="M320 0 L330 470" />
        <path d="M0 390 L800 400" />
      </g>
    </svg>
  );
}
