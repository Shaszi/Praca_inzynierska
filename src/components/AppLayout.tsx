import { Outlet } from 'react-router-dom'
import { TopNavigation } from './TopNavigation'

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950/60 text-slate-100">
      <TopNavigation />
      <main className="flex min-h-0 flex-1 p-4 md:p-6">
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  )
}