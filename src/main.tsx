import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppShell from './components/AppShell'
import { loadThemePreference } from './utils/themePreference'
import './styles/theme.css'
import './styles/layout.css'

const themePreference = loadThemePreference(
  () => window.localStorage,
  window.matchMedia?.bind(window),
)

document.documentElement.dataset.theme = themePreference.theme
document.documentElement.style.colorScheme = themePreference.theme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell initialThemePreference={themePreference} />
  </StrictMode>,
)
