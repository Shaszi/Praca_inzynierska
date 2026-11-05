/**
 * Pokrycie kroku słowami. W projekcie miernik pokazuje „ponad połowa", nie „64%",
 * bo w trakcie ruchu procent jest nieczytelny i niczego nie podpowiada.
 */
export function coverageWords(percent: number): string {
  if (percent <= 0) return 'nic jeszcze'
  if (percent < 25) return 'początek'
  if (percent < 50) return 'mniej niż połowa'
  if (percent < 75) return 'ponad połowa'
  if (percent < 95) return 'prawie całość'
  return 'cała kreska'
}
