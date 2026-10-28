import { LogIn, Upload } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { signInWithGoogle } from '../services/auth';
import { MENU_ITEMS } from '../constants/menu';

// No celular: 4 atalhos + botão central de importar
const MOBILE_PATHS = ['/', '/transactions', '/insights', '/settings'];

export function BottomNav() {
    const { user } = useFinanceiro();
    const location = useLocation();
    const items = MENU_ITEMS.filter(i => MOBILE_PATHS.includes(i.path));
    const left = items.slice(0, 2);
    const right = items.slice(2);

    const renderItem = (item: typeof items[number]) => {
        const isActive = location.pathname === item.path;
        return (
            <Link key={item.path} to={item.path} className="flex w-14 flex-col items-center justify-center gap-1">
                <item.icon size={20} className={isActive ? 'text-primary' : 'text-text-muted'} />
                <span className={`font-mono text-[9px] uppercase tracking-wider ${isActive ? 'text-primary' : 'text-text-dim'}`}>
                    {item.label}
                </span>
            </Link>
        );
    };

    return (
        <nav className="fixed bottom-3 left-3 right-3 z-50 rounded-2xl border border-white/[0.08] bg-card/85 px-2 py-2 backdrop-blur-xl md:hidden">
            <div className="flex items-center justify-between">
                {left.map(renderItem)}
                {user && !user.isAnonymous ? (
                    <Link to="/import" aria-label="Importar extrato" className="-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-bg shadow-[0_0_24px_-4px_rgb(198_241_53/0.7)]">
                        <Upload size={22} />
                    </Link>
                ) : (
                    <button onClick={signInWithGoogle} aria-label="Entrar" className="-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-bg cursor-pointer">
                        <LogIn size={22} />
                    </button>
                )}
                {right.map(renderItem)}
            </div>
        </nav>
    );
}
