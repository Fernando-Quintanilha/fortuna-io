import { ReactNode } from 'react';
import { Sidebar, Logo } from './Sidebar';
import { BottomNav } from './BottomNav';

interface MainLayoutProps {
    children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
    return (
        <div className="flex min-h-screen text-text-main">
            <Sidebar />

            <main className="w-full flex-1 md:ml-64">
                <div className="flex items-center justify-between px-4 pt-5 md:hidden">
                    <Logo />
                </div>
                <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-10">
                    {children}
                </div>
            </main>

            <BottomNav />
        </div>
    );
}
