import { Link } from 'react-router-dom'
import { plural } from '../../../../utils/plural'
import type { Challenge } from '../../utils/dailyChallenge'

/** Wyzwanie dnia — różowa karta z dekoracją elips. */
export function DailyChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <section className="relative flex flex-col gap-3 overflow-hidden rounded-[24px] bg-pink p-[22px] text-on-accent lg:col-span-5">
      <svg
        viewBox="0 0 170 150"
        className="pointer-events-none absolute -top-2.5 -right-6 w-[170px] opacity-90"
        fill="none"
        stroke="#1a1236"
        strokeOpacity=".22"
        strokeWidth="6"
        strokeLinecap="round"
        aria-hidden
      >
        <ellipse cx="96" cy="60" rx="60" ry="30" transform="rotate(-18 96 60)" />
        <ellipse cx="96" cy="60" rx="38" ry="18" transform="rotate(-18 96 60)" />
        <ellipse cx="110" cy="112" rx="44" ry="20" transform="rotate(-10 110 112)" />
      </svg>

      <span className="self-start rounded-full bg-[rgb(26_18_54_/_0.14)] px-3 py-[5px] text-[13px] font-bold">
        Wyzwanie dnia
      </span>
      <h3 className="font-display text-[26px] font-bold leading-[1.1]">{challenge.title}</h3>
      <p className="text-[15px] font-medium">
        {challenge.strokes} kresek, około {challenge.minutes} {plural(challenge.minutes, 'minuty', 'minut', 'minut')}.{' '}
        {challenge.body}
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-[rgb(255_255_255_/_0.35)] px-3 py-1.5 text-[13px] font-bold">Podtrzymuje serię</span>
        <span className="rounded-full bg-[rgb(255_255_255_/_0.35)] px-3 py-1.5 text-[13px] font-bold">Odznaka dnia</span>
      </div>
      <Link
        to="/app/practice"
        className="inline-flex min-h-12 items-center justify-center self-start rounded-full bg-on-accent px-[22px] font-bold text-white transition hover:bg-[#2c2154]"
      >
        Zacznij wyzwanie
      </Link>
    </section>
  )
}
