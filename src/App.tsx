import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Import } from './pages/Import';
import { Insights } from './pages/Insights';
import { Wallet } from './pages/Wallet';
import { Settings } from './pages/Settings';

function App() {
    return (
        <BrowserRouter>
            <MainLayout>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/import" element={<Import />} />
                    <Route path="/insights" element={<Insights />} />
                    <Route path="/wallet" element={<Wallet />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </MainLayout>
        </BrowserRouter>
    );
}

export default App;
