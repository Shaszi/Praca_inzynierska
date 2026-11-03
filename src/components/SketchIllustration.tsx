// Szkic studium kuli: linie konstrukcyjne (akcent, przerywane) i kreski "ucznia" rysowane animacją.
export function SketchIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 320" className={className} role="img" aria-label="Szkic kuli z liniami konstrukcyjnymi">
      <style>{`
        .sketch-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: sketch-draw 1.4s ease-out forwards; }
        @keyframes sketch-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { .sketch-draw { animation: none; stroke-dashoffset: 0; } }
      `}</style>

      <g fill="none" strokeLinecap="round" className="stroke-accent" strokeWidth="1.5" strokeDasharray="6 7" opacity="0.7">
        <line x1="40" y1="160" x2="360" y2="160" />
        <line x1="200" y1="20" x2="200" y2="300" />
        <ellipse cx="200" cy="160" rx="110" ry="34" />
      </g>

      <g fill="none" strokeLinecap="round" className="stroke-ink">
        <path pathLength={1} className="sketch-draw" strokeWidth="3" d="M200 50c62 0 111 49 110 111-1 61-50 109-111 109-60 0-109-49-109-110 0-61 49-110 110-110" />
        <path pathLength={1} className="sketch-draw" strokeWidth="2" style={{ animationDelay: '0.5s' }} d="M92 168c22 26 64 40 110 40 44 0 84-13 106-36" />
        <g strokeWidth="1.6" opacity="0.8">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path
              key={i}
              pathLength={1}
              className="sketch-draw"
              style={{ animationDelay: `${0.9 + i * 0.08}s` }}
              d={`M${236 + i * 9} ${244 - i * 4}l${30 - i * 2} -${44 - i * 3}`}
            />
          ))}
        </g>
        <path pathLength={1} className="sketch-draw" strokeWidth="2.4" style={{ animationDelay: '1.2s' }} d="M120 292c50 8 130 8 190-4" />
      </g>
    </svg>
  )
}
