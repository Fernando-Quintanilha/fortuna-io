import { ReactNode } from 'react';

interface PanelProps {
    title?: string;
    action?: ReactNode;
    className?: string;
    children: ReactNode;
}

// Cartão de vidro com título no estilo "// comentário"
export function Panel({ title, action, className = '', children }: PanelProps) {
    return (
        <section className={`glass p-5 md:p-6 ${className}`}>
            {(title || action) && (
                <header className="mb-5 flex items-center justify-between gap-3">
                    {title && <h3 className="label-mono"><span className="text-primary">//</span> {title}</h3>}
                    {action}
                </header>
            )}
            {children}
        </section>
    );
}
