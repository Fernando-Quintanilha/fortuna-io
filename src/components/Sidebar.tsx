import { LogOut, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { usePrivacy } from '../contexts/PrivacyContext';
import { signInWithGoogle, logout } from '../services/auth';
import { MENU_ITEMS } from '../constants/menu';

export function Logo() {
    return (
        <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 font-mono text-sm font-semibold text-primary shadow-[0_0_18px_-4px_rgb(198_241_53/0.6)]">
                F<span className="animate-pulse">_</span>
            </div>
            <h1 className="font-mono text-lg font-semibold tracking-tight text-text-main">
                fortuna<span className="text-primary">.io</span>
            </h1>
        </div>
    );
}

export function Sidebar() {
    const { user } = useFinanceiro();
    const { isVisible, toggleVisibility } = usePrivacy();
    const location = useLocation();

    return (
        <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 flex-col border-r border-white/[0.06] bg-bg/70 p-5 backdrop-blur-xl md:flex">
            <div className="mb-10 px-2 pt-1">
                <Logo />
            </div>

            <p className="label-mono mb-3 px-3">menu</p>
            <nav className="flex-1 space-y-1">
                {MENU_ITEMS.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all
                                ${isActive
                                    ? 'bg-white/[0.05] text-text-main'
                                    : 'text-text-muted hover:bg-white/[0.03] hover:text-text-main'}`}
                        >
                            {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgb(198_241_53/0.8)]" />}
                            <item.icon size={18} className={isActive ? 'text-primary' : ''} />
                            <span className="flex-1 font-medium">{item.label}</span>
                            <span className="font-mono text-[10px] text-text-dim">{item.hotkey}</span>
                        </Link>
                    );
                })}
            </nav>

            <button
                onClick={toggleVisibility}
                className="mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-muted transition-colors hover:bg-white/[0.03] hover:text-text-main cursor-pointer"
            >
                {isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                <span className="flex-1 text-left font-medium">{isVisible ? 'Ocultar valores' : 'Mostrar valores'}</span>
            </button>

            <div className="border-t border-white/[0.06] pt-4">
                {user && !user.isAnonymous ? (
                    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="h-9 w-9 rounded-lg" />
                        ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stroke text-text-muted">
                                <UserIcon size={18} />
                            </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium text-text-main" title={user.displayName || ''}>
                                {user.displayName?.split(' ')[0]}
                            </span>
                            <span className="flex items-center gap-1 font-mono text-[10px] text-success">
                                <span className="h-1.5 w-1.5 rounded-full bg-success" /> online
                            </span>
                        </div>
                        <button onClick={logout} title="Sair" className="rounded-lg p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer">
                            <LogOut size={16} />
                        </button>
                    </div>
                ) : (
                    <button onClick={signInWithGoogle} className="btn-primary w-full">
                        Entrar com Google
                    </button>
                )}
            </div>
        </aside>
    );
}
