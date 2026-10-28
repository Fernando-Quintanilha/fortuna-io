import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DailyPoint } from '../../lib/insights';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { formatCompact } from '../../lib/format';
import { ChartTooltip, AXIS_PROPS, SERIES } from './ChartTooltip';

// Gasto acumulado no mês vs. mês anterior
export function DailyChart({ data }: { data: DailyPoint[] }) {
    const { isVisible } = usePrivacy();

    return (
        <div>
            <div className="mb-3 flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: SERIES.expense }} />Este mês</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t border-dashed" style={{ borderColor: SERIES.neutral }} />Mês anterior</span>
            </div>
            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="day" {...AXIS_PROPS} interval={4} />
                        <YAxis {...AXIS_PROPS} width={44} tickFormatter={v => isVisible ? formatCompact(v) : '•••'} />
                        <Tooltip content={<ChartTooltip labelFormatter={d => `dia ${d}`} />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                        <Line type="monotone" dataKey="previous" name="Mês anterior" stroke={SERIES.neutral} strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
                        <Line type="monotone" dataKey="current" name="Este mês" stroke={SERIES.expense} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#0E1116', strokeWidth: 2 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
