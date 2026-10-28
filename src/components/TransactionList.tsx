import { Trash2, Pencil } from 'lucide-react';
import { Transaction } from '../types';
import { SecureValue } from './SecureValue';
import { iconFor, categoriesFor } from '../lib/categories';
import { formatDate } from '../lib/format';

interface TransactionListProps {
    transactions: Transaction[];
    onDelete?: (id: string) => void;
    onEdit?: (transaction: Transaction) => void;
    onCategoryChange?: (transaction: Transaction, category: string) => void;
}

const TONE = {
    income: { icon: 'text-success bg-success/10 border-success/20', amount: 'text-success', prefix: '+ R$ ' },
    expense: { icon: 'text-text-main bg-white/[0.04] border-white/10', amount: 'text-text-main', prefix: '- R$ ' },
    investment: { icon: 'text-accent bg-accent/10 border-accent/20', amount: 'text-accent', prefix: '→ R$ ' },
    transfer: { icon: 'text-text-dim bg-white/[0.02] border-white/[0.06]', amount: 'text-text-dim', prefix: '⇄ R$ ' },
};

export function TransactionList({ transactions, onDelete, onEdit, onCategoryChange }: TransactionListProps) {
    if (transactions.length === 0) {
        return (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-stroke font-mono text-sm text-text-muted">
                <p>&gt; nenhuma transação encontrada_</p>
            </div>
        );
    }

    return (
        <ul className="divide-y divide-white/[0.05]">
            {transactions.map((t) => {
                const tone = TONE[t.type] ?? TONE.expense;
                const Icon = iconFor(t.category);
                return (
                    <li key={t.id} className="group flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className={`shrink-0 rounded-xl border p-2 ${tone.icon}`}>
                                <Icon size={16} />
                            </div>
                            <div className="flex min-w-0 flex-col">
                                <p className={`truncate text-sm font-medium ${t.type === 'transfer' ? 'text-text-muted' : 'text-text-main'}`}>
                                    {t.description}
                                </p>
                                <div className="flex items-center gap-1.5 truncate font-mono text-[11px] text-text-dim">
                                    {onCategoryChange ? (
                                        <select
                                            aria-label="Categoria"
                                            value={t.category}
                                            onChange={e => onCategoryChange(t, e.target.value)}
                                            className="max-w-[140px] cursor-pointer truncate rounded border border-transparent bg-transparent text-[11px] text-text-muted hover:border-stroke focus:border-primary/60 focus:outline-none"
                                        >
                                            {!categoriesFor(t.type).some(c => c.label === t.category) && <option value={t.category}>{t.category}</option>}
                                            {categoriesFor(t.type).map(c => <option key={c.label} value={c.label} className="bg-card">{c.label}</option>)}
                                        </select>
                                    ) : (
                                        <span className="truncate">{t.category}</span>
                                    )}
                                    {t.categorySource && t.categorySource !== 'user' && (
                                        <span title="Categorizado automaticamente" className="text-primary/70">◆</span>
                                    )}
                                    <span>·</span>
                                    <span className="shrink-0">{formatDate(t.date)}</span>
                                    {t.bank && <><span>·</span><span className="truncate">{t.bank}</span></>}
                                </div>
                            </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            <span className={`whitespace-nowrap font-mono text-sm font-medium ${tone.amount}`}>
                                <SecureValue value={t.amount} prefix={tone.prefix} />
                            </span>

                            {(onEdit || onDelete) && (
                                <div className="flex gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                                    {onEdit && (
                                        <button onClick={() => onEdit(t)} title="Editar" className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer">
                                            <Pencil size={15} />
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button onClick={() => onDelete(t.id)} title="Excluir" className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer">
                                            <Trash2 size={15} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
