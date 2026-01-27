import { Trash2, ArrowUpCircle, ArrowDownCircle, PieChart, Pencil } from 'lucide-react'; // <--- Import Pencil
import { Transaction } from '../types';

interface TransactionListProps {
    transactions: Transaction[];
    onDelete: (id: string) => void;
    onEdit: (transaction: Transaction) => void; // <--- Nova Prop
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
                    className="group flex items-center justify-between p-4 bg-card border border-stroke rounded-xl hover:border-text-muted/30 transition-all"
                >
                    {/* Esquerda: Ícone e Texto */}
                    <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${t.type === 'income' ? 'bg-success/10 text-success' :
                                t.type === 'expense' ? 'bg-danger/10 text-danger' :
                                    'bg-accent/10 text-accent'
                            }`}>
                            {t.type === 'income' ? <ArrowUpCircle size={20} /> :
                                t.type === 'expense' ? <ArrowDownCircle size={20} /> :
                                    <PieChart size={20} />}
                        </div>

                        <div>
                            <p className="font-medium text-text-main">{t.description}</p>
                            <div className="flex items-center gap-2 text-xs text-text-muted">
                                <span>{t.category}</span>
                                <span>•</span>
                                <span>{formatDate(t.date)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Direita: Valor e Botões */}
                    <div className="flex items-center gap-4">
                        <span className={`font-semibold ${t.type === 'income' ? 'text-success' : 'text-text-main'
                            }`}>
                            {t.type === 'income' ? '+ ' : '- '}
                            {formatCurrency(t.amount)}
                        </span>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            {/* Botão Editar */}
                            <button
                                onClick={() => onEdit(t)} // <--- Chama o edit
                                className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                title="Editar"
                            >
                                <Pencil size={18} />
                            </button>

                            {/* Botão Excluir */}
                            <button
                                onClick={() => onDelete(t.id)}
                                className="p-2 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                title="Excluir"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}