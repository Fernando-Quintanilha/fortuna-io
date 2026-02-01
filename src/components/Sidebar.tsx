import { LayoutDashboard, ArrowRightLeft, Wallet, Settings, LogOut, User as UserIcon } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { signInWithGoogle, logout } from '../services/auth';
import { Link, useLocation } from 'react-router-dom'; 

export function Sidebar() {
  const { user } = useFinanceiro();
  const location = useLocation();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: ArrowRightLeft, label: 'Transações', path: '/transactions' },
    { icon: Wallet, label: 'Carteira', path: '/wallet' },
    { icon: Settings, label: 'Ajustes', path: '/settings' },
  ];

  return (
    <aside className="hidden md:flex w-64 flex-col fixed left-0 top-0 h-screen bg-card border-r border-stroke p-6 transition-all z-50">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
          <span className="font-bold text-lg text-white">F</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-main">Fortuna</h1>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                ${isActive
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_rgba(37,99,235,0.1)]'
                  : 'text-text-muted hover:bg-stroke hover:text-text-main'
                }`}
            >
              <item.icon size={20} className={isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-main'} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-6 border-t border-stroke">
        {user && !user.isAnonymous ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-bg/50 border border-stroke">
              {user.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-9 h-9 rounded-full border border-stroke" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-stroke flex items-center justify-center text-text-muted">
                  <UserIcon size={18} />
                </div>
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium text-text-main truncate" title={user.displayName || ''}>
                  {user.displayName?.split(' ')[0]}
                </span>
                <span className="text-[10px] text-text-muted truncate">Premium</span>
              </div>
            </div>
            <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-xs font-medium text-danger hover:bg-danger/10 py-2 rounded-lg transition-colors">
              <LogOut size={14} /> Sair
            </button>
          </div>
        ) : (
          <button onClick={signInWithGoogle} className="w-full bg-text-main hover:bg-gray-200 text-bg font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
            Entrar
          </button>
        )}
      </div>
    </aside>
  );
}