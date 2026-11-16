import type { ComponentType, SVGProps } from 'react'
import { ChartIcon, HomeIcon, ImageIcon, LayersIcon, PencilIcon } from '../icons'

export type NavItem = {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean
}

// Etykiety i kolejność wprost z projektu.
const BASE_ITEMS: NavItem[] = [
  { to: '/app', label: 'Start', icon: HomeIcon, end: true },
  { to: '/app/practice', label: 'Ćwicz', icon: PencilIcon, end: true },
  { to: '/app/library', label: 'Biblioteka', icon: LayersIcon },
  { to: '/app/references', label: 'Moje wzorce', icon: PencilIcon },
  { to: '/app/practice/image', label: 'Ze zdjęcia', icon: ImageIcon },
  { to: '/app/progress', label: 'Postęp', icon: ChartIcon },
]

/** Pozycje menu dla ról — dokładane dopiero, gdy rola jest znana. */
export function navItemsFor(hasRole: (role: 'moderator' | 'admin') => boolean): NavItem[] {
  return [
    ...BASE_ITEMS,
    ...(hasRole('moderator') ? [{ to: '/app/moderation', label: 'Moderacja', icon: ChartIcon }] : []),
    ...(hasRole('admin') ? [{ to: '/app/admin', label: 'Panel', icon: HomeIcon }] : []),
  ]
}
