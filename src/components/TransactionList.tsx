import { Trash2, ArrowUpCircle, ArrowDownCircle, PieChart, Pencil } from 'lucide-react';
import { Transaction } from '../types';

interface TransactionListProps {
    transactions: Transaction[];
    onDelete: (id: string) => void;
    onEdit: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, onDelete, onEdit }: TransactionListProps) {

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-text-muted border-2 border-dashed border-stroke rounded-xl">
                <p>Nenhuma transação encontrada.</p>
            </div>
        );
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const formatDate = (dateString: string) => {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="space-y-3">
            {transactions.map((t) => (
                <div
                    key={t.id}
                    className="group flex items-center justify-between p-3 sm:p-4 bg-card border border-stroke rounded-xl hover:border-text-muted/30 transition-all"
                >
                    <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">

                        {/* Ícone */}
                        <div className={`p-2 rounded-lg shrink-0 ${t.type === 'income' ? 'bg-success/10 text-success' :
                                t.type === 'expense' ? 'bg-danger/10 text-danger' :
                                    'bg-accent/10 text-accent'
                            }`}>
                            {t.type === 'income' ? <ArrowUpCircle size={18} /> :
                                t.type === 'expense' ? <ArrowDownCircle size={18} /> :
                                    <PieChart size={18} />}
                        </div>

                        {/* Textos com Truncate (... se for grande demais) */}
                        <div className="flex flex-col min-w-0">
                            <p className="font-medium text-text-main truncate text-sm sm:text-base">
                                {t.description}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-text-muted truncate">
                                <span className="truncate max-w-[80px] sm:max-w-none">{t.category}</span>
                                <span className="shrink-0">•</span>
                                <span className="shrink-0">{formatDate(t.date)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <span className={`font-semibold whitespace-nowrap text-sm sm:text-base ${t.type === 'income' ? 'text-success' : 'text-text-main'
                            }`}>
                            {t.type === 'income' ? '+ ' : t.type === 'expense' ? '- ' : ''}
                            {formatCurrency(t.amount)}
                        </span>

                        {/* Botões: Visíveis sempre no Mobile, Hover no PC */}
                        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity opacity-100">
                            <button
                                onClick={() => onEdit(t)}
                                className="p-1.5 sm:p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                title="Editar"
                            >
                                <Pencil size={16} />
                            </button>

                            <button
                                onClick={() => onDelete(t.id)}
                                className="p-1.5 sm:p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                title="Excluir"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}