import { LayoutDashboard, ArrowRightLeft, Wallet, Settings, Upload, LineChart, LucideIcon } from 'lucide-react';

export interface MenuItem {
    icon: LucideIcon;
    label: string;
    path: string;
    hotkey: string;
}

export const MENU_ITEMS: MenuItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', hotkey: '01' },
    { icon: ArrowRightLeft, label: 'Transações', path: '/transactions', hotkey: '02' },
    { icon: Upload, label: 'Importar', path: '/import', hotkey: '03' },
    { icon: LineChart, label: 'Relatórios', path: '/insights', hotkey: '04' },
    { icon: Wallet, label: 'Carteira', path: '/wallet', hotkey: '05' },
    { icon: Settings, label: 'Ajustes', path: '/settings', hotkey: '06' },
];
