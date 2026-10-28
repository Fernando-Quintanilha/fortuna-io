import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MonthPoint } from '../../lib/insights';
import { usePrivacy } from '../../contexts/PrivacyContext';
import { formatCompact } from '../../lib/format';
import { ChartTooltip, AXIS_PROPS, SERIES } from './ChartTooltip';

// Entradas x gastos nos últimos meses (uma escala só)
export function TrendChart({ data }: { data: MonthPoint[] }) {
    const { isVisible } = usePrivacy();

    return (
        <div>
            <div className="mb-3 flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.income }} />Entradas</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES.expense }} />Gastos</span>
            </div>
            <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barGap={2} barCategoryGap="28%">
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="label" {...AXIS_PROPS} />
                        <YAxis {...AXIS_PROPS} width={44} tickFormatter={v => isVisible ? formatCompact(v) : '•••'} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Bar dataKey="income" name="Entradas" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
                        <Bar dataKey="expense" name="Gastos" fill={SERIES.expense} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
