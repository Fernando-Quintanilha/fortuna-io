import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Repeat, Store, Upload } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { Panel } from '../components/ui/Panel';
import { PageHeader } from '../components/ui/PageHeader';
import { MonthSwitcher } from '../components/ui/MonthSwitcher';
import { AlertCard } from '../components/ui/AlertCard';
import { SecureValue } from '../components/SecureValue';
import { TrendChart } from '../components/charts/TrendChart';
import { DailyChart } from '../components/charts/DailyChart';
import { CategoryBars } from '../components/charts/CategoryBars';
import { iconFor } from '../lib/categories';
import { formatDate, monthKey, monthLabel, shiftMonth } from '../lib/format';
import {
    monthTotals, categoryBreakdown, topMerchants, monthlySeries, cumulativeDaily, detectRecurring, buildAlerts,
} from '../lib/insights';

export function Insights() {
    const { transactions } = useFinanceiro();
    const [month, setMonth] = useState(monthKey(new Date()));

    const r = useMemo(() => {
        const totals = monthTotals(transactions, month);
        const prevMonths = [1, 2, 3].map(i => monthTotals(transactions, shiftMonth(month, -i)).expense).filter(v => v > 0);
        const avgExpense = prevMonths.length ? prevMonths.reduce((a, b) => a + b, 0) / prevMonths.length : 0;
        const recurring = detectRecurring(transactions, month);
        return {
            totals,
            avgExpense,
            deltaPct: avgExpense > 0 ? ((totals.expense - avgExpense) / avgExpense) * 100 : null,
            savingsRate: totals.income > 0 ? ((totals.income - totals.expense) / totals.income) * 100 : null,
            categories: categoryBreakdown(transactions, month),
            merchants: topMerchants(transactions, month, 8),
            series: monthlySeries(transactions, month, 6),
            daily: cumulativeDaily(transactions, month),
            recurring,
            recurringTotal: recurring.reduce((a, x) => a + x.avgAmount, 0),
            alerts: buildAlerts(transactions, month),
        };
    }, [transactions, month]);

    const hasData = r.totals.expense > 0 || r.totals.income > 0;

    return (
        <div className="animate-enter space-y-6">
            <PageHeader
                eyebrow="relatorios"
                title="Para onde vai seu dinheiro"
                subtitle={`Análise de ${monthLabel(month)} comparada aos meses anteriores.`}
                actions={<MonthSwitcher month={month} onChange={setMonth} />}
            />

            {!hasData ? (
                <Panel>
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                        <p className="font-mono text-sm text-text-muted">&gt; sem dados para {monthLabel(month)}_</p>
                        <Link to="/import" className="btn-primary"><Upload size={16} /> Importar extrato</Link>
                    </div>
                </Panel>
            ) : (
                <>
                    {/* Número principal */}
                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="glass relative overflow-hidden p-6 lg:col-span-2">
                            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
                            <p className="label-mono mb-3">gasto em {monthLabel(month)}</p>
                            <p className="font-mono text-4xl font-semibold tracking-tight md:text-5xl"><SecureValue value={r.totals.expense} /></p>
                            <p className="mt-3 text-sm text-text-muted">
                                {r.deltaPct === null
                                    ? 'Sem meses anteriores para comparar.'
                                    : <>
                                        <span className={r.deltaPct > 0 ? 'text-danger' : 'text-success'}>
                                            {r.deltaPct > 0 ? '▲' : '▼'} {Math.abs(r.deltaPct).toFixed(0)}%
                                        </span>{' '}
                                        {r.deltaPct > 0 ? 'acima' : 'abaixo'} da sua média dos últimos meses (<SecureValue value={r.avgExpense} />).
                                    </>}
                            </p>
                        </div>
                        <div className="glass grid grid-cols-2 gap-4 p-6 lg:grid-cols-1">
                            <div>
                                <p className="label-mono mb-1">entradas</p>
                                <p className="font-mono text-xl"><SecureValue value={r.totals.income} /></p>
                            </div>
                            <div>
                                <p className="label-mono mb-1">taxa de poupança</p>
                                <p className={`font-mono text-xl ${r.savingsRate !== null && r.savingsRate < 0 ? 'text-danger' : 'text-text-main'}`}>
                                    {r.savingsRate === null ? '—' : `${r.savingsRate.toFixed(0)}%`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {r.alerts.length > 0 && (
                        <div className="grid gap-3 md:grid-cols-2">
                            {r.alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
                        </div>
                    )}

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Panel title="gastos por categoria · vs. média 3 meses">
                            <CategoryBars data={r.categories} limit={12} />
                        </Panel>
                        <div className="space-y-6">
                            <Panel title="ritmo de gasto no mês">
                                <DailyChart data={r.daily} />
                            </Panel>
                            <Panel title="entradas x gastos · 6 meses">
                                <TrendChart data={r.series} />
                            </Panel>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <Panel title="onde você mais gastou">
                            {r.merchants.length === 0 ? (
                                <p className="py-6 text-center font-mono text-sm text-text-muted">&gt; sem dados_</p>
                            ) : (
                                <ol className="space-y-1">
                                    {r.merchants.map((m, i) => (
                                        <li key={m.merchant} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
                                            <span className="w-5 font-mono text-xs text-text-dim">{String(i + 1).padStart(2, '0')}</span>
                                            <Store size={14} className="text-text-muted" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm">{m.label}</p>
                                                <p className="font-mono text-[11px] text-text-dim">{m.category} · {m.count}x</p>
                                            </div>
                                            <span className="font-mono text-sm"><SecureValue value={m.total} /></span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </Panel>

                        <Panel
                            title="assinaturas e gastos recorrentes"
                            action={r.recurring.length > 0 && (
                                <span className="font-mono text-[11px] text-text-muted">
                                    ≈ <SecureValue value={r.recurringTotal} />/mês
                                </span>
                            )}
                        >
                            {r.recurring.length === 0 ? (
                                <p className="py-6 text-center text-sm text-text-muted">
                                    Nenhum gasto recorrente detectado ainda. Importe pelo menos 2 meses de extrato.
                                </p>
                            ) : (
                                <ul className="space-y-1">
                                    {r.recurring.map(x => {
                                        const Icon = iconFor(x.category);
                                        return (
                                            <li key={x.merchant} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
                                                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-text-muted"><Icon size={14} /></div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="flex items-center gap-2 truncate text-sm">
                                                        {x.label}
                                                        {x.isNew && <span className="chip border-accent/40 text-accent">novo</span>}
                                                    </p>
                                                    <p className="font-mono text-[11px] text-text-dim">
                                                        <Repeat size={10} className="mr-1 inline" />{x.months} meses · último {formatDate(x.lastDate)}
                                                    </p>
                                                </div>
                                                <span className="font-mono text-sm"><SecureValue value={x.avgAmount} /></span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Panel>
                    </div>
                </>
            )}
        </div>
    );
}
