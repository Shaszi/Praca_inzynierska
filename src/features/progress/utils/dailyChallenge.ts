import type { DayKey } from './goalProgress'

export type Challenge = {
  title: string
  body: string
  strokes: number
  minutes: number
}

/**
 * Wyzwanie dnia. Treść jest stała, a wybór deterministyczny z daty — ten sam dzień
 * daje to samo wyzwanie każdemu i po odświeżeniu strony.
 *
 * shortcut: lista jest wpisana w kod, bo w bazie nie ma tabeli wyzwań. Przenieść do
 * bazy, gdy wyzwania mają być redagowane bez wdrożenia albo liczyć się do nagród.
 */
const CHALLENGES: Challenge[] = [
  {
    title: 'Elipsy w rzucie 3/4',
    body: 'Ćwiczy płynny ruch z łokcia, który przyda się przy oczach i kształcie głowy.',
    strokes: 12,
    minutes: 3,
  },
  {
    title: 'Proste linie bez linijki',
    body: 'Uczy prowadzić rękę jednym pociągnięciem, zamiast dociągać linię w kilku ruchach.',
    strokes: 15,
    minutes: 3,
  },
  {
    title: 'Łuki w jednym kierunku',
    body: 'Wyrównuje napięcie nadgarstka, dzięki czemu krzywe przestają falować w połowie.',
    strokes: 10,
    minutes: 2,
  },
  {
    title: 'Okręgi od środka',
    body: 'Buduje czucie odległości od punktu, na którym stoi cała konstrukcja głowy.',
    strokes: 12,
    minutes: 4,
  },
  {
    title: 'Linie pod kątem 45°',
    body: 'Najtrudniejszy kierunek dla prawej ręki. Po tym ćwiczeniu skosy przestają się zawijać.',
    strokes: 14,
    minutes: 3,
  },
]

export function challengeForDay(today: DayKey): Challenge {
  // Suma cyfr daty wystarczy: zmienia się codziennie i nie wymaga biblioteki.
  const seed = today.split('-').reduce((sum, part) => sum + Number(part), 0)
  return CHALLENGES[seed % CHALLENGES.length]
}
