import { useState } from 'react';
import { LayoutDashboard, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { NewTransactionModal } from '../components/NewTransactionModal';
import { TransactionList } from '../components/TransactionList';
import { ExpensesChart } from '../components/ExpensesChart';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { Transaction } from '../types'; // Importe o tipo

export function Dashboard() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    // Estado para guardar quem estamos editando
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    const { transactions, summary, deleteTransaction } = useFinanceiro();

    // Função para abrir o modal em modo de edição
    function handleEdit(transaction: Transaction) {
        setEditingTransaction(transaction); // Salva os dados
        setIsModalOpen(true); // Abre o modal
    }

    // Função para abrir o modal em modo de criação (limpo)
    function handleCreate() {
        setEditingTransaction(null); // Garante que está limpo
        setIsModalOpen(true);
    }

    return (
        <div className="animate-in fade-in duration-500 pb-20 md:pb-0">
            <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-text-main">Dashboard</h2>
                    <p className="text-text-muted mt-1">Sua visão financeira em tempo real</p>
                </div>

                <button
                    onClick={handleCreate}
                    className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-[0_4px_20px_rgba(37,99,235,0.25)] active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                    <span>+ Nova Transação</span>
                </button>
            </header>

            {/* Cards ... (Mantém igual) */}
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
                    {/* Passamos a função de editar para a lista */}
                    <TransactionList
                        transactions={transactions}
                        onDelete={deleteTransaction}
                        onEdit={handleEdit}
                    />
                </div>
            </div>

            {/* Passamos os dados de edição para o modal */}
            <NewTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                transactionToEdit={editingTransaction}
            />
        </div>
    );
}