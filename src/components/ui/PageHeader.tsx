import { ReactNode } from 'react';

interface PageHeaderProps {
    eyebrow: string;
    title: ReactNode;
    subtitle?: string;
    actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
    return (
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <p className="label-mono mb-2">
                    <span className="text-primary">~/</span>{eyebrow}
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-text-main md:text-4xl">{title}</h2>
                {subtitle && <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
    );
}
