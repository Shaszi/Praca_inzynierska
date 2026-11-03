import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initTheme } from './features/theme/theme'
import './index.css'

// Przed pierwszym renderem, żeby atrybut zgadzał się ze zapamiętanym wyborem
// i żeby nie było mignięcia jasnym motywem.
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)