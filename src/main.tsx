import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { PrivacyProvider } from './contexts/PrivacyContext';
import { FinanceProvider } from './contexts/FinanceContext';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <PrivacyProvider>
            <FinanceProvider>
                <App />
            </FinanceProvider>
        </PrivacyProvider>
    </StrictMode>,
);
