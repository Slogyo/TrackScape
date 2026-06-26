import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppShell from './components/AppShell'
import './styles/theme.css'
import './styles/layout.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)
