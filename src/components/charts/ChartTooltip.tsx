import { usePrivacy } from '../../contexts/PrivacyContext';
import { formatCurrency } from '../../lib/format';

interface TooltipEntry {
    name?: string | number;
    value?: number | string | null;
    color?: string;
    dataKey?: string | number;
}

interface ChartTooltipProps {
    active?: boolean;
    label?: string | number;
    payload?: TooltipEntry[];
    labelFormatter?: (label: string | number) => string;
}

// Tooltip compartilhado dos gráficos (respeita o modo privacidade)
export function ChartTooltip({ active, label, payload, labelFormatter }: ChartTooltipProps) {
    const { isVisible } = usePrivacy();
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-xl border border-white/10 bg-raised/95 px-3 py-2 shadow-xl backdrop-blur">
            <p className="label-mono mb-1.5">{labelFormatter && label !== undefined ? labelFormatter(label) : label}</p>
            {payload.filter(p => p.value !== null && p.value !== undefined).map(p => (
                <div key={String(p.dataKey)} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                    <span className="text-text-muted">{p.name}</span>
                    <span className="ml-auto pl-4 font-mono text-text-main">
                        {isVisible ? formatCurrency(Number(p.value)) : '••••••'}
                    </span>
                </div>
            ))}
        </div>
    );
}

export const AXIS_PROPS = {
    stroke: '#5A6270',
    tick: { fill: '#8A93A3', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' },
    tickLine: false,
    axisLine: false,
};

export const SERIES = {
    income: '#3987e5',
    expense: '#7FA312',
    neutral: '#5A6270',
};
