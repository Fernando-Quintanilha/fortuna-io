import { Info, AlertTriangle, OctagonAlert } from 'lucide-react';
import { Alert } from '../../lib/insights';

const STYLE = {
    info: { icon: Info, cls: 'border-accent/25 bg-accent/5 text-accent', label: 'info' },
    warning: { icon: AlertTriangle, cls: 'border-warning/25 bg-warning/5 text-warning', label: 'atenção' },
    critical: { icon: OctagonAlert, cls: 'border-danger/25 bg-danger/5 text-danger', label: 'crítico' },
};

// Cor de status nunca sozinha: sempre ícone + rótulo
export function AlertCard({ alert }: { alert: Alert }) {
    const s = STYLE[alert.level];
    return (
        <div className={`flex gap-3 rounded-2xl border p-4 ${s.cls}`}>
            <s.icon size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-sm font-medium text-text-main">
                    <span className="mr-2 font-mono text-[10px] uppercase tracking-wider opacity-80">[{s.label}]</span>
                    {alert.title}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">{alert.detail}</p>
            </div>
        </div>
    );
}
