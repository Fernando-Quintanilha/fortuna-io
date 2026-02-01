import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

interface MainLayoutProps {
    children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
    return (
        <div className="min-h-screen bg-bg flex text-text-main">
            <Sidebar />

            <main className="flex-1 md:ml-64 transition-all w-full">
                <div className="p-6 pb-24 md:p-10 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>

            <BottomNav />
        </div>
    );
}