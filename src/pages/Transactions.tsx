import { useState, useMemo } from 'react';
import { Search, Plus } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { TransactionList } from '../components/TransactionList';
import { NewTransactionModal } from '../components/NewTransactionModal';
import { Panel } from '../components/ui/Panel';
import { PageHeader } from '../components/ui/PageHeader';
import { MonthSwitcher } from '../components/ui/MonthSwitcher';
import { SecureValue } from '../components/SecureValue';
import { Transaction, TransactionType } from '../types';
import { monthKey } from '../lib/format';
import { monthTotals } from '../lib/insights';
import { TYPE_LABEL } from '../lib/categories';

type TypeFilter = 'all' | TransactionType;

export function Transactions() {
    const { transactions, deleteTransaction, editTransaction } = useFinanceiro();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [month, setMonth] = useState(monthKey(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [bankFilter, setBankFilter] = useState('all');

    const monthTransactions = useMemo(
        () => transactions.filter(t => t.date.slice(0, 7) === month),
        [transactions, month]
    );

    const banks = useMemo(
        () => [...new Set(monthTransactions.map(t => t.bank ?? 'Manual'))].sort(),
        [monthTransactions]
    );

    const filteredTransactions = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return monthTransactions.filter(t =>
            (typeFilter === 'all' || t.type === typeFilter) &&
            (bankFilter === 'all' || (t.bank ?? 'Manual') === bankFilter) &&
            (t.description.toLowerCase().includes(term) || t.category.toLowerCase().includes(term))
        );
    }, [monthTransactions, searchTerm, typeFilter, bankFilter]);

    const totals = useMemo(() => monthTotals(transactions, month), [transactions, month]);

    function handleEdit(transaction: Transaction) {
        setEditingTransaction(transaction);
        setIsModalOpen(true);
    }

    function handleCreate() {
        setEditingTransaction(null);
        setIsModalOpen(true);
    }

    return (
        <div className="animate-enter space-y-6">
            <PageHeader
                eyebrow="transacoes"
                title="Histórico"
                subtitle="Corrija uma categoria e o Fortuna aprende para os próximos extratos."
                actions={<button onClick={handleCreate} className="btn-primary"><Plus size={16} /> Lançamento</button>}
            />

            <div className="glass flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                <MonthSwitcher month={month} onChange={setMonth} />

                <div className="flex items-center gap-6 font-mono text-sm">
                    <div>
                        <p className="label-mono">entradas</p>
                        <p className="text-success"><SecureValue value={totals.income} /></p>
                    </div>
                    <div className="h-8 w-px bg-stroke" />
                    <div>
                        <p className="label-mono">gastos</p>
                        <p className="text-danger"><SecureValue value={totals.expense} /></p>
                    </div>
                </div>

                <div className="relative w-full lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
                    <input
                        type="text"
                        placeholder="buscar..."
                        className="input pl-9 font-mono text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {(['all', 'expense', 'income', 'investment', 'transfer'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTypeFilter(t)}
                        className={`chip cursor-pointer py-1 ${typeFilter === t ? 'border-primary/50 bg-primary/10 text-primary' : 'border-stroke text-text-muted hover:text-text-main'}`}
                    >
                        {t === 'all' ? 'todos' : TYPE_LABEL[t]}
                    </button>
                ))}
                {banks.length > 1 && (
                    <select
                        aria-label="Filtrar por banco"
                        value={bankFilter}
                        onChange={e => setBankFilter(e.target.value)}
                        className="chip cursor-pointer border-stroke bg-transparent py-1 text-text-muted"
                    >
                        <option value="all" className="bg-card">todos os bancos</option>
                        {banks.map(b => <option key={b} value={b} className="bg-card">{b}</option>)}
                    </select>
                )}
            </div>

            <Panel title={`${filteredTransactions.length} lançamentos`}>
                <TransactionList
                    transactions={filteredTransactions}
                    onDelete={deleteTransaction}
                    onEdit={handleEdit}
                    onCategoryChange={(t, category) => editTransaction(t.id, { category }).catch(console.error)}
                />
            </Panel>

            <NewTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                transactionToEdit={editingTransaction}
            />
        </div>
    );
}
