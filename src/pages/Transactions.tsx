import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Search, FilterX } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { TransactionList } from '../components/TransactionList';
import { NewTransactionModal } from '../components/NewTransactionModal';
import { Transaction } from '../types';

export function Transactions() {
    const { transactions, deleteTransaction, editTransaction } = useFinanceiro();

    // Estados Locais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    // Controle de Data (Mês Atual)
    const [currentDate, setCurrentDate] = useState(new Date());

    // Estado para busca por texto
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Lógica para filtrar as transações pelo Mês Selecionado e Busca
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const tDate = new Date(t.date);
            // Ajuste de fuso horário simples para garantir mês correto
            const tMonth = tDate.getUTCMonth();
            const tYear = tDate.getUTCFullYear();

            const isSameMonth = tMonth === currentDate.getMonth() && tYear === currentDate.getFullYear();

            // Filtro de texto (busca por descrição ou categoria)
            const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.category.toLowerCase().includes(searchTerm.toLowerCase());

            return isSameMonth && matchesSearch;
        });
    }, [transactions, currentDate, searchTerm]);

    // 2. Cálculos do Mês (Entradas e Saídas apenas do mês visível)
    const monthSummary = useMemo(() => {
        return filteredTransactions.reduce(
            (acc, t) => {
                if (t.type === 'income') acc.income += t.amount;
                if (t.type === 'expense') acc.expense += t.amount;
                return acc;
            },
            { income: 0, expense: 0 }
        );
    }, [filteredTransactions]);

    // Funções de Navegação de Mês
    function prevMonth() {
        setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)));
    }

    function nextMonth() {
        setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)));
    }

    // Formatação do Título (Ex: "Janeiro de 2026")
    const monthTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentDate);

    // Funções do Modal (Reutilizadas do Dashboard)
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

            {/* Cabeçalho com Título e Botão */}
            <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-text-main">Histórico</h2>
                    <p className="text-text-muted mt-1">Gerencie todos os seus lançamentos</p>
                </div>

                <button
                    onClick={handleCreate}
                    className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                    <span>+ Nova Transação</span>
                </button>
            </header>

            {/* Barra de Ferramentas (Navegação de Mês + Busca) */}
            <div className="bg-card border border-stroke rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">

                {/* Navegação de Mês */}
                <div className="flex items-center gap-4 bg-bg p-2 rounded-xl border border-stroke">
                    <button title='Mês anterior' onClick={prevMonth} className="p-2 hover:bg-stroke rounded-lg text-text-muted hover:text-text-main transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-semibold text-text-main capitalize min-w-[140px] text-center">
                        {monthTitle}
                    </span>
                    <button title='Mês seguinte' onClick={nextMonth} className="p-2 hover:bg-stroke rounded-lg text-text-muted hover:text-text-main transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>

                {/* Resumo Rápido do Mês */}
                <div className="flex items-center gap-6 text-sm">
                    <div className="flex flex-col items-end">
                        <span className="text-text-muted">Entradas</span>
                        <span className="text-success font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthSummary.income)}
                        </span>
                    </div>
                    <div className="h-8 w-px bg-stroke"></div>
                    <div className="flex flex-col items-end">
                        <span className="text-text-muted">Saídas</span>
                        <span className="text-danger font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(monthSummary.expense)}
                        </span>
                    </div>
                </div>

                {/* Barra de Busca */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar lançamentos..."
                        className="w-full bg-bg border border-stroke rounded-xl pl-10 pr-4 py-2.5 text-text-main focus:outline-none focus:border-primary transition-colors text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Lista de Transações */}
            <div className="bg-card border border-stroke rounded-2xl p-6 min-h-[400px]">
                {filteredTransactions.length > 0 ? (
                    <TransactionList
                        transactions={filteredTransactions}
                        onDelete={deleteTransaction}
                        onEdit={handleEdit}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-text-muted gap-2">
                        <FilterX size={48} className="opacity-20" />
                        <p>Nenhuma transação encontrada neste mês.</p>
                    </div>
                )}
            </div>

            {/* Modal (Reutilizado) */}
            <NewTransactionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                transactionToEdit={editingTransaction}
            />
        </div>
    );
}