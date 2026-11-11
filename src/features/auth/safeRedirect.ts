/**
 * Adres powrotu po logowaniu pochodzi ze stanu routera, więc trzeba go traktować jak
 * dane z zewnątrz. Dopuszczamy wyłącznie ścieżki wewnętrzne.
 *
 * `(?!\/)` odrzuca `//evil.com`: przeglądarka czyta to jako adres zewnętrzny, a kod
 * logowania sklejał go z `location.origin`, co dawało otwarte przekierowanie.
 */
export function safeRedirect(from: unknown): string {
  return typeof from === 'string' && /^\/(?!\/)/.test(from) ? from : '/app'
}
