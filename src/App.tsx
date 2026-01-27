import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions'; // Crie esse arquivo (passo 2)
import { Wallet } from './pages/Wallet';             // Crie esse arquivo (passo 2)
import { Settings } from './pages/Settings';         // Crie esse arquivo (passo 2)

function App() {
    return (
        <BrowserRouter>
            <MainLayout>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/wallet" element={<Wallet />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </MainLayout>
        </BrowserRouter>
    );
}

export default App;