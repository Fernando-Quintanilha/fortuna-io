import { useState } from 'react';
import { LayoutDashboard, TrendingUp, TrendingDown, Wallet, Eye, EyeOff } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { NewTransactionModal } from '../components/NewTransactionModal';
import { TransactionList } from '../components/TransactionList';
import { ExpensesChart } from '../components/ExpensesChart';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { usePrivacy } from '../contexts/PrivacyContext'; 
import { Transaction } from '../types';

export function Dashboard() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    const { transactions, summary, deleteTransaction } = useFinanceiro();

    const { isVisible, toggleVisibility } = usePrivacy();

    function handleEdit(transaction: Transaction) {
        setEditingTransaction(transaction);
        setIsModalOpen(true);
    }

    function handleCreate() {
        setEditingTransaction(null);
        setIsModalOpen(true);
    }

    return (
        <div className="animate-in fade-in duration-500 pb-20 md:pb-0">
            <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold text-text-main">Dashboard</h2>

                        <button
                            onClick={toggleVisibility}
                            className="p-1 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                            title={isVisible ? "Ocultar valores" : "Mostrar valores"}
                        >
                            {isVisible ? <Eye size={24} /> : <EyeOff size={24} />}
                        </button>
                    </div>

                    <p className="text-text-muted mt-1">Sua visão financeira em tempo real</p>
                </div>

                <button
                    onClick={handleCreate}
                    className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-[0_4px_20px_rgba(37,99,235,0.25)] active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                    <span>+ Nova Transação</span>
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <KPICard title="Saldo Atual" amount={summary.totalBalance} icon={LayoutDashboard} variant="default" />
                <KPICard title="Entradas" amount={summary.totalIncome} icon={TrendingUp} variant="success" />
                <KPICard title="Saídas" amount={summary.totalExpense} icon={TrendingDown} variant="danger" />
                <KPICard title="Total Investido" amount={summary.totalInvested} icon={Wallet} variant="accent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <ExpensesChart transactions={transactions} />
                </div>

                <div className="lg:col-span-2 bg-card border border-stroke rounded-2xl p-6 min-h-[400px]">
                    <h3 className="text-xl font-bold text-text-main mb-6">Transações Recentes</h3>
                    <TransactionList
                        transactions={transactions}
                        onDelete={deleteTransaction}
                        onEdit={handleEdit}
                    />
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