import { LayoutDashboard, ArrowRightLeft, Wallet, Settings, LogIn, LogOut } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { signInWithGoogle, logout } from '../services/auth';
import { Link, useLocation } from 'react-router-dom';

export function BottomNav() {
    const { user } = useFinanceiro();
    const location = useLocation();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Início', path: '/' },
        { icon: ArrowRightLeft, label: 'Transações', path: '/transactions' },
        { icon: Wallet, label: 'Carteira', path: '/wallet' },
        { icon: Settings, label: 'Ajustes', path: '/settings' },
    ];

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-card/95 backdrop-blur-md border-t border-stroke px-6 pb-2 pt-2 z-50">
            <div className="flex justify-between items-center h-full">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.label}
                            to={item.path}
                            className="flex flex-col items-center justify-center gap-1 w-16"
                        >
                            <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-text-muted'
                                }`}>
                                <item.icon size={24} />
                            </div>
                            <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-text-muted'
                                }`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* Botão de Usuário (Mantém igual) */}
                {user && !user.isAnonymous ? (
                    <button onClick={logout} className="flex flex-col items-center justify-center gap-1 w-16">
                        <div className="p-0.5 rounded-full border-2 border-primary/20">
                            {user.photoURL ? <img src={user.photoURL} alt="User" className="w-6 h-6 rounded-full" /> : <LogOut size={24} className="text-text-muted" />}
                        </div>
                        <span className="text-[10px] font-medium text-text-muted">Sair</span>
                    </button>
                ) : (
                    <button onClick={signInWithGoogle} className="flex flex-col items-center justify-center gap-1 w-16">
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><LogIn size={24} /></div>
                        <span className="text-[10px] font-medium text-primary">Entrar</span>
                    </button>
                )}
            </div>
        </nav>
    );
}