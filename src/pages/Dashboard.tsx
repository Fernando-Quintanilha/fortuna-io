import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Wallet, Activity, Upload, Plus, ArrowRight } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { NewTransactionModal } from '../components/NewTransactionModal';
import { TransactionList } from '../components/TransactionList';
import { Panel } from '../components/ui/Panel';
import { PageHeader } from '../components/ui/PageHeader';
import { TrendChart } from '../components/charts/TrendChart';
import { CategoryBars } from '../components/charts/CategoryBars';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { Transaction } from '../types';
import { monthKey, monthLabel, shiftMonth } from '../lib/format';
import { monthTotals, categoryBreakdown, monthlySeries, buildAlerts } from '../lib/insights';
import { AlertCard } from '../components/ui/AlertCard';

const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

export function Dashboard() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const { user, transactions, deleteTransaction } = useFinanceiro();

    const month = monthKey(new Date());
    const data = useMemo(() => {
        const cur = monthTotals(transactions, month);
        const prev = monthTotals(transactions, shiftMonth(month, -1));
        return {
            cur, prev,
            categories: categoryBreakdown(transactions, month),
            series: monthlySeries(transactions, month, 6),
            alerts: buildAlerts(transactions, month),
            recent: transactions.slice(0, 8),
        };
    }, [transactions, month]);

    function handleEdit(transaction: Transaction) {
        setEditingTransaction(transaction);
        setIsModalOpen(true);
    }

    function handleCreate() {
        setEditingTransaction(null);
        setIsModalOpen(true);
    }

    const firstName = user?.displayName?.split(' ')[0];
    const isEmptyMonth = data.cur.expense === 0 && data.cur.income === 0;

    return (
        <div className="animate-enter space-y-6">
            <PageHeader
                eyebrow="dashboard"
                title={<>Olá{firstName ? `, ${firstName}` : ''}<span className="text-primary">.</span></>}
                subtitle={`Resumo de ${monthLabel(month)}`}
                actions={<>
                    <button onClick={handleCreate} className="btn-ghost"><Plus size={16} /> Lançamento</button>
                    <Link to="/import" className="btn-primary"><Upload size={16} /> Importar extrato</Link>
                </>}
            />

            {isEmptyMonth && (
                <Link to="/import" className="glass glass-hover flex items-center gap-4 border-primary/25 p-5">
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-primary"><Upload size={22} /></div>
                    <div className="flex-1">
                        <p className="font-medium">Nada lançado neste mês ainda</p>
                        <p className="text-sm text-text-muted">Suba o extrato OFX ou CSV dos seus bancos e o Fortuna categoriza tudo para você.</p>
                    </div>
                    <ArrowRight className="text-primary" size={20} />
                </Link>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard title="saldo do mês" amount={data.cur.balance} icon={Activity} highlight hint="entradas − gastos − aportes" />
                <KPICard title="entradas" amount={data.cur.income} icon={TrendingUp} variant="success" delta={pct(data.cur.income, data.prev.income)} hint="vs. mês anterior" />
                <KPICard title="gastos" amount={data.cur.expense} icon={TrendingDown} variant="danger" delta={pct(data.cur.expense, data.prev.expense)} deltaGoodWhenUp={false} hint="vs. mês anterior" />
                <KPICard title="investido" amount={data.cur.invested} icon={Wallet} variant="accent" hint="aportes no mês" />
            </div>

            {data.alerts.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                    {data.alerts.slice(0, 4).map((a, i) => <AlertCard key={i} alert={a} />)}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <Panel title="entradas x gastos · 6 meses" className="lg:col-span-3">
                    <TrendChart data={data.series} />
                </Panel>
                <Panel
                    title="para onde foi o dinheiro"
                    className="lg:col-span-2"
                    action={<Link to="/insights" className="font-mono text-[11px] text-text-muted hover:text-primary">ver tudo →</Link>}
                >
                    <CategoryBars data={data.categories} limit={5} />
                </Panel>
            </div>

            <Panel
                title="transações recentes"
                action={<Link to="/transactions" className="font-mono text-[11px] text-text-muted hover:text-primary">histórico →</Link>}
            >
                <TransactionList transactions={data.recent} onDelete={deleteTransaction} onEdit={handleEdit} />
            </Panel>

            <NewTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                transactionToEdit={editingTransaction}
            />
        </div>
    );
}
