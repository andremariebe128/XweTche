const ESPACE = " ";

// Montants au format de la charte : espace des milliers et « FCFA » (6.3).
export function fcfa(n: number) {
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE)}${ESPACE}FCFA`;
}

export function pluriel(n: number, un: string, plusieurs: string) {
  return `${n} ${n > 1 ? plusieurs : un}`;
}
