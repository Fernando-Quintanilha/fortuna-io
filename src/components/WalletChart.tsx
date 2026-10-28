import { useMemo } from 'react';
import { Transaction } from '../types';
import { iconFor } from '../lib/categories';
import { SecureValue } from './SecureValue';

interface WalletChartProps {
    transactions: Transaction[];
}

// Alocação por classe de ativo: barras com rótulo direto (legível com qualquer nº de classes)
export function WalletChart({ transactions }: WalletChartProps) {
    const data = useMemo(() => {
        const grouped = transactions
            .filter(t => t.type === 'investment')
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] ?? 0) + Number(t.amount);
                return acc;
            }, {} as Record<string, number>);
        const total = Object.values(grouped).reduce((a, b) => a + b, 0) || 1;
        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value, share: value / total }))
            .sort((a, b) => b.value - a.value);
    }, [transactions]);

    if (data.length === 0) {
        return <p className="py-10 text-center font-mono text-sm text-text-muted">&gt; nenhum investimento cadastrado_</p>;
    }

    return (
        <ul className="space-y-4">
            {data.map(d => {
                const Icon = iconFor(d.name);
                return (
                    <li key={d.name}>
                        <div className="mb-1.5 flex items-center gap-2 text-sm">
                            <Icon size={14} className="text-accent" />
                            <span className="flex-1 truncate">{d.name}</span>
                            <span className="font-mono text-xs text-text-muted">{(d.share * 100).toFixed(1)}%</span>
                            <span className="w-28 text-right font-mono"><SecureValue value={d.value} /></span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                            <div className="h-full rounded-full bg-accent/80" style={{ width: `${Math.max(2, d.share * 100)}%` }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
