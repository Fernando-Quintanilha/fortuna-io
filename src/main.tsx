import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PrivacyProvider } from './contexts/PrivacyContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PrivacyProvider>
      <App />
    </PrivacyProvider>

  </StrictMode>,
)