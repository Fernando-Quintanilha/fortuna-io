import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { CategoryStat } from '../../lib/insights';
import { iconFor } from '../../lib/categories';
import { SecureValue } from '../SecureValue';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { formatCurrency } from '../../lib/format';

interface CategoryBarsProps {
    data: CategoryStat[];
    limit?: number;
    showDelta?: boolean;
}

// Ranking de categorias: barras horizontais de uma cor (magnitude), rótulo e valor diretos
export function CategoryBars({ data, limit = 6, showDelta = true }: CategoryBarsProps) {
    const { isVisible } = usePrivacy();
    if (data.length === 0) {
        return <p className="py-10 text-center font-mono text-sm text-text-muted">&gt; sem gastos neste mês_</p>;
    }

    const rows = data.slice(0, limit);
    const max = rows[0].total || 1;

    return (
        <ul className="space-y-4">
            {rows.map(c => {
                const Icon = iconFor(c.category);
                const up = (c.deltaPct ?? 0) >= 0;
                return (
                    <li key={c.category} title={c.avgPrev ? `Média dos 3 meses anteriores: ${isVisible ? formatCurrency(c.avgPrev) : '••••••'}` : 'Sem histórico anterior'}>
                        <div className="mb-1.5 flex items-center gap-2 text-sm">
                            <Icon size={14} className="text-text-muted" />
                            <span className="flex-1 truncate text-text-main">{c.category}</span>
                            {showDelta && c.deltaPct !== null && Math.abs(c.deltaPct) >= 5 && (
                                <span className={`flex items-center font-mono text-[11px] ${up ? 'text-danger' : 'text-success'}`}>
                                    {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                    {Math.abs(c.deltaPct).toFixed(0)}%
                                </span>
                            )}
                            <span className="font-mono text-xs text-text-muted">{(c.share * 100).toFixed(0)}%</span>
                            <span className="w-24 text-right font-mono text-sm text-text-main"><SecureValue value={c.total} /></span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-primary-dim to-primary transition-all duration-700"
                                style={{ width: `${Math.max(2, (c.total / max) * 100)}%` }}
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
