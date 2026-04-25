import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/practice', label: 'Practice' },
  { to: '/teacher', label: 'Teacher' },
]

export function TopNavigation() {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 md:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
            Drawing Trainer
          </p>
          <h1 className="text-lg font-semibold text-slate-100">Studio</h1>
        </div>

        <nav className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-200'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}