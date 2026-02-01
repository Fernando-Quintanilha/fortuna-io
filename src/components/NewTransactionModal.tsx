import { useState, useEffect } from 'react';
import {
    X, Loader2,
    Utensils, Car, ShoppingCart, HeartPulse, Shirt, Dumbbell, Gamepad2, Home, GraduationCap, MoreHorizontal,
    Bitcoin, Building2, TrendingUp, Landmark, Banknote, PiggyBank
} from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { Transaction, TransactionType } from '../types';

interface NewTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactionToEdit?: Transaction | null;
}

const EXPENSE_CATEGORIES = [
    { id: 'alimentacao', label: 'Alimentação', icon: Utensils },
    { id: 'lazer', label: 'Lazer', icon: Gamepad2 },
    { id: 'transporte', label: 'Uber/Delivery', icon: Car },
    { id: 'saude', label: 'Saúde/Farmácia', icon: HeartPulse },
    { id: 'compras', label: 'Compras', icon: ShoppingCart },
    { id: 'roupas', label: 'Outfit', icon: Shirt },
    { id: 'academia', label: 'Academia', icon: Dumbbell },
    { id: 'casa', label: 'Casa/Contas', icon: Home },
    { id: 'educacao', label: 'Educação', icon: GraduationCap },
    { id: 'outros', label: 'Outros', icon: MoreHorizontal },
];

const INVESTMENT_CATEGORIES = [
    { id: 'acoes', label: 'Ações', icon: TrendingUp },
    { id: 'fiis', label: 'FIIs', icon: Building2 },
    { id: 'cripto', label: 'Cripto', icon: Bitcoin },
    { id: 'rendafixa', label: 'Renda Fixa', icon: Landmark },
    { id: 'reserva', label: 'Reserva', icon: PiggyBank },
    { id: 'exterior', label: 'Exterior', icon: Banknote },
    { id: 'outros', label: 'Outros', icon: MoreHorizontal },
];

export function NewTransactionModal({ isOpen, onClose, transactionToEdit }: NewTransactionModalProps) {
    const { addTransaction, editTransaction, loading } = useFinanceiro();

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>('expense');
    const [category, setCategory] = useState(''); // Começa vazio para forçar escolha
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Define qual lista de categorias mostrar
    const currentCategories = type === 'investment' ? INVESTMENT_CATEGORIES : EXPENSE_CATEGORIES;

    useEffect(() => {
        if (isOpen && transactionToEdit) {
            setDescription(transactionToEdit.description);
            setAmount(String(transactionToEdit.amount));
            setType(transactionToEdit.type);
            setCategory(transactionToEdit.category);
            setDate(transactionToEdit.date);
        } else if (isOpen && !transactionToEdit) {
            setDescription('');
            setAmount('');
            setType('expense');
            setCategory('Alimentação'); // Reset padrão para despesa
            setDate(new Date().toISOString().split('T')[0]);
        }
    }, [isOpen, transactionToEdit]);

    // Resetar categoria se mudar o tipo (para não salvar "Bitcoin" como "Despesa")
    useEffect(() => {
        if (!transactionToEdit && isOpen) {
            setCategory(type === 'investment' ? 'Ações' : 'Alimentação');
        }
    }, [type, isOpen, transactionToEdit]);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!description || !amount) return;

        const data = {
            description,
            amount: Number(amount),
            type,
            category,
            date
        };

        if (transactionToEdit) {
            await editTransaction(transactionToEdit.id, data);
        } else {
            await addTransaction(data);
        }
        onClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card w-full max-w-lg rounded-2xl border border-stroke shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">

                <div className="flex items-center justify-between p-6 border-b border-stroke sticky top-0 bg-card z-10">
                    <h2 className="text-xl font-bold text-text-main">
                        {transactionToEdit ? 'Editar Transação' : 'Nova Transação'}
                    </h2>
                    <button onClick={onClose} type="button" aria-label="Fechar" className="text-text-muted hover:text-text-main transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    <div className="grid grid-cols-3 gap-2 p-1 bg-bg rounded-xl border border-stroke">
                        {(['income', 'expense', 'investment'] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={`py-2 text-sm font-medium rounded-lg transition-all ${type === t
                                        ? t === 'income' ? 'bg-success/20 text-success'
                                            : t === 'expense' ? 'bg-danger/20 text-danger'
                                                : 'bg-accent/20 text-accent'
                                        : 'text-text-muted hover:text-text-main'
                                    }`}
                            >
                                {t === 'income' ? 'Receita' : t === 'expense' ? 'Despesa' : 'Investimento'}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-text-muted mb-1">Valor Aplicado (R$)</label>
                            <input
                                id="amount" type="number" step="0.01" required placeholder="0.00"
                                className="w-full bg-bg border border-stroke rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-colors text-lg font-semibold"
                                value={amount} onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="date" className="block text-sm font-medium text-text-muted mb-1">Data da Aplicação</label>
                            <input
                                id="date" type="date" required
                                className="w-full bg-bg border border-stroke rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-colors scheme-dark"
                                value={date} onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-muted mb-3">
                            {type === 'investment' ? 'Tipo de Ativo' : 'Categoria'}
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {currentCategories.map((cat) => (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setCategory(cat.label)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-2 ${category === cat.label
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-bg border-stroke text-text-muted hover:border-text-muted/50 hover:text-text-main'
                                        }`}
                                >
                                    <cat.icon size={20} />
                                    <span className="text-[10px] font-medium">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-text-muted mb-1">
                            {type === 'investment' ? 'Ativo (Ex: PETR4, Bitcoin)' : 'Título / Descrição'}
                        </label>
                        <input
                            id="description" type="text" required
                            placeholder={type === 'investment' ? "Ex: PETR4, BTC, Tesouro Direto..." : "Ex: Burger King..."}
                            className="w-full bg-bg border border-stroke rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-primary transition-colors"
                            value={description} onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit" disabled={loading}
                        className="w-full bg-primary hover:bg-blue-600 text-white font-semibold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center justify-center gap-2 mt-2 cursor-pointer text-lg"
                    >
                        {loading ? <Loader2 className="animate-spin" size={24} /> : (transactionToEdit ? 'Salvar Alterações' : 'Confirmar Lançamento')}
                    </button>
                </form>
            </div>
        </div>
    );
}