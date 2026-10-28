import { useState, useMemo } from 'react';
import { PlusCircle, TrendingUp } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { TransactionList } from '../components/TransactionList';
import { NewTransactionModal } from '../components/NewTransactionModal';
import { WalletChart } from '../components/WalletChart';
import { SecureValue } from '../components/SecureValue';
import { Panel } from '../components/ui/Panel';
import { PageHeader } from '../components/ui/PageHeader';
import { Transaction } from '../types';

export function Wallet() {
    const { transactions, deleteTransaction } = useFinanceiro();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    const investments = useMemo(() => transactions.filter(t => t.type === 'investment'), [transactions]);
    const totalInvested = useMemo(() => investments.reduce((acc, curr) => acc + curr.amount, 0), [investments]);

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
                eyebrow="carteira"
                title="Minha carteira"
                subtitle="Valor aplicado por classe de ativo."
                actions={<button onClick={handleCreate} className="btn-primary"><PlusCircle size={16} /> Novo aporte</button>}
            />

            <div className="glass relative flex items-center justify-between overflow-hidden p-6 md:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
                <div>
                    <p className="label-mono mb-2">patrimônio aplicado</p>
                    <p className="font-mono text-4xl font-semibold tracking-tight md:text-5xl">
                        <SecureValue value={totalInvested} />
                    </p>
                </div>
                <div className="hidden h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent md:flex">
                    <TrendingUp size={26} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Panel title="alocação" className="lg:col-span-1">
                    <WalletChart transactions={transactions} />
                </Panel>

                <Panel title="histórico de aportes" className="lg:col-span-2">
                    {investments.length > 0 ? (
                        <TransactionList transactions={investments} onDelete={deleteTransaction} onEdit={handleEdit} />
                    ) : (
                        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-stroke font-mono text-sm text-text-muted">
                            <p>&gt; nenhum ativo na carteira ainda_</p>
                            <button onClick={handleCreate} className="mt-2 text-accent hover:underline cursor-pointer">fazer primeiro aporte</button>
                        </div>
                    )}
                </Panel>
            </div>

            <NewTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                transactionToEdit={editingTransaction}
                defaultType="investment"
            />
        </div>
    );
}
