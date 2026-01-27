import { useState, useMemo } from 'react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { TransactionList } from '../components/TransactionList';
import { NewTransactionModal } from '../components/NewTransactionModal';
import { WalletChart } from '../components/WalletChart';
import { Transaction } from '../types';
import { Wallet as WalletIcon, TrendingUp, PlusCircle } from 'lucide-react';

export function Wallet() {
    const { transactions, deleteTransaction, editTransaction } = useFinanceiro();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Filtra APENAS Investimentos
    const investments = useMemo(() => {
        return transactions.filter(t => t.type === 'investment');
    }, [transactions]);

    // Calcula Total Aplicado
    const totalInvested = useMemo(() => {
        return investments.reduce((acc, curr) => acc + curr.amount, 0);
    }, [investments]);

    // Modal Handlers
    function handleEdit(transaction: Transaction) {
        setEditingTransaction(transaction);
        setIsModalOpen(true);
    }
    function handleCreate() {
        setEditingTransaction(null);
        setIsModalOpen(true);
    }

    return (
        <div className="animate-in fade-in duration-500 pb-20 md:pb-0 space-y-6">

            {/* Header */}
            <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-text-main flex items-center gap-2">
                        <WalletIcon className="text-accent" /> Minha Carteira
                    </h2>
                    <p className="text-text-muted mt-1">Gerencie seus ativos e acompanhe a evolução (Valor Aplicado)</p>
                </div>

                <button
                    onClick={handleCreate}
                    className="bg-accent hover:bg-cyan-600 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-[0_4px_20px_rgba(6,182,212,0.25)] active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                    <PlusCircle size={20} />
                    <span>Novo Aporte</span>
                </button>
            </header>

            {/* Card de Resumo Principal */}
            <div className="bg-gradient-to-r from-card to-bg border border-stroke rounded-2xl p-6 md:p-8 flex items-center justify-between shadow-lg">
                <div>
                    <p className="text-text-muted font-medium mb-1">Patrimônio Total Aplicado</p>
                    <h3 className="text-4xl font-bold text-text-main tracking-tight">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInvested)}
                    </h3>
                </div>
                <div className="hidden md:flex h-16 w-16 bg-accent/10 rounded-full items-center justify-center text-accent">
                    <TrendingUp size={32} />
                </div>
            </div>

            {/* Grid: Gráfico + Lista */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Gráfico de Alocação */}
                <div className="lg:col-span-1">
                    <WalletChart transactions={transactions} />
                </div>

                {/* Lista de Ativos */}
                <div className="lg:col-span-2 bg-card border border-stroke rounded-2xl p-6 min-h-[400px]">
                    <h3 className="text-xl font-bold text-text-main mb-6">Histórico de Aportes</h3>
                    {investments.length > 0 ? (
                        <TransactionList
                            transactions={investments}
                            onDelete={deleteTransaction}
                            onEdit={handleEdit}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-text-muted border-2 border-dashed border-stroke rounded-xl">
                            <p>Nenhum ativo na carteira ainda.</p>
                            <button onClick={handleCreate} className="text-accent hover:underline mt-2 text-sm">
                                Fazer primeiro aporte
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <NewTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                transactionToEdit={editingTransaction}
            />
        </div>
    );
}