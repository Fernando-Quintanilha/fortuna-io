import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { Transaction, TransactionType } from '../types';
import { categoriesFor, defaultCategory, TYPE_LABEL } from '../lib/categories';
import { todayISO } from '../lib/format';

interface NewTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactionToEdit?: Transaction | null;
    defaultType?: TransactionType;
}

const TYPE_TONE: Record<TransactionType, string> = {
    income: 'bg-success/15 text-success border-success/30',
    expense: 'bg-danger/15 text-danger border-danger/30',
    investment: 'bg-accent/15 text-accent border-accent/30',
    transfer: 'bg-white/10 text-text-main border-white/20',
};

export function NewTransactionModal({ isOpen, onClose, transactionToEdit, defaultType = 'expense' }: NewTransactionModalProps) {
    const { addTransaction, editTransaction, loading } = useFinanceiro();

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>(defaultType);
    const [category, setCategory] = useState(defaultCategory(defaultType));
    const [date, setDate] = useState(todayISO());
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setError('');
        if (transactionToEdit) {
            setDescription(transactionToEdit.description);
            setAmount(String(transactionToEdit.amount));
            setType(transactionToEdit.type);
            setCategory(transactionToEdit.category);
            setDate(transactionToEdit.date);
        } else {
            setDescription('');
            setAmount('');
            setType(defaultType);
            setCategory(defaultCategory(defaultType));
            setDate(todayISO());
        }
    }, [isOpen, transactionToEdit, defaultType]);

    if (!isOpen) return null;

    // Trocar o tipo reinicia a categoria (não salvar "Cripto" como despesa)
    function changeType(t: TransactionType) {
        setType(t);
        setCategory(defaultCategory(t));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!description || !amount) return;

        const data = { description, amount: Number(amount), type, category, date };

        try {
            if (transactionToEdit) {
                await editTransaction(transactionToEdit.id, data);
            } else {
                await addTransaction(data);
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
        }
    }

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
            <div
                className="glass max-h-[92vh] w-full max-w-lg animate-enter overflow-y-auto rounded-b-none bg-card/95 sm:rounded-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-card/95 px-6 py-4">
                    <div>
                        <p className="label-mono"><span className="text-primary">//</span> {transactionToEdit ? 'editar' : 'novo lançamento'}</p>
                    </div>
                    <button onClick={onClose} type="button" aria-label="Fechar" className="text-text-muted transition-colors hover:text-text-main cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 p-6">
                    <div className="grid grid-cols-4 gap-1 rounded-xl border border-stroke bg-bg/60 p-1">
                        {(['expense', 'income', 'investment', 'transfer'] as const).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => changeType(t)}
                                className={`rounded-lg border py-2 text-xs font-medium transition-all cursor-pointer ${type === t ? TYPE_TONE[t] : 'border-transparent text-text-muted hover:text-text-main'}`}
                            >
                                {TYPE_LABEL[t]}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="amount" className="label-mono mb-1.5 block">valor (R$)</label>
                            <input
                                id="amount" type="number" step="0.01" min="0" required placeholder="0,00"
                                className="input font-mono text-lg font-semibold"
                                value={amount} onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="date" className="label-mono mb-1.5 block">data</label>
                            <input
                                id="date" type="date" required
                                className="input font-mono"
                                value={date} onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="description" className="label-mono mb-1.5 block">
                            {type === 'investment' ? 'ativo' : 'descrição'}
                        </label>
                        <input
                            id="description" type="text" required
                            placeholder={type === 'investment' ? 'Ex: PETR4, BTC, Tesouro Selic...' : 'Ex: Burger King...'}
                            className="input"
                            value={description} onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    <div>
                        <p className="label-mono mb-2">{type === 'investment' ? 'tipo de ativo' : 'categoria'}</p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {categoriesFor(type).map((cat) => (
                                <button
                                    key={cat.label}
                                    type="button"
                                    onClick={() => setCategory(cat.label)}
                                    className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-all cursor-pointer ${category === cat.label
                                        ? 'border-primary/60 bg-primary/10 text-primary'
                                        : 'border-stroke bg-bg/40 text-text-muted hover:border-white/20 hover:text-text-main'
                                        }`}
                                >
                                    <cat.icon size={18} />
                                    <span className="text-center text-[10px] font-medium leading-tight">{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}

                    <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (transactionToEdit ? 'Salvar alterações' : 'Confirmar lançamento')}
                    </button>
                </form>
            </div>
        </div>
    );
}
