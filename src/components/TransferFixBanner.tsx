import { useState } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { SecureValue } from './SecureValue';
import { formatDate } from '../lib/format';
import type { TransferFix } from '../lib/transfers';

interface Props {
    fixes: TransferFix[];
    onApply(fixes: TransferFix[]): Promise<void>;
}

// Lançamentos já gravados que são só dinheiro mudando de conta: o usuário confirma antes de corrigir
export function TransferFixBanner({ fixes, onApply }: Props) {
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    if (!fixes.length) return null;
    const total = fixes.reduce((s, f) => s + f.transaction.amount, 0);

    async function apply() {
        setRunning(true); setError(null);
        try { await onApply(fixes); }
        catch (e) { setError(e instanceof Error ? e.message : 'Falha ao corrigir.'); }
        finally { setRunning(false); }
    }

    return (
        <div className="glass border-primary/25 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="w-fit rounded-xl border border-primary/30 bg-primary/10 p-3 text-primary"><ArrowLeftRight size={22} /></div>
                <div className="flex-1">
                    <p className="font-medium">{fixes.length} lançamentos são dinheiro mudando de conta, não receita nem gasto</p>
                    <p className="text-sm text-text-muted">
                        Pix para você mesmo, resgates de investimento e valores que saíram de um banco e entraram em outro
                        (<span className="font-mono"><SecureValue value={total} /></span>). Hoje eles distorcem entradas, gastos e saldo.
                    </p>
                </div>
                <button onClick={apply} disabled={running} className="btn-primary">
                    {running ? <Loader2 size={16} className="animate-spin" /> : <>Corrigir {fixes.length}</>}
                </button>
            </div>
            <details className="mt-3">
                <summary className="cursor-pointer font-mono text-[11px] text-text-muted hover:text-primary">ver quais</summary>
                <ul className="mt-2 divide-y divide-white/[0.05]">
                    {fixes.map(f => (
                        <li key={f.transaction.id} className="flex items-center gap-3 py-2 text-sm">
                            <span className="font-mono text-xs text-text-dim">{formatDate(f.transaction.date)}</span>
                            <span className="min-w-0 flex-1 truncate" title={f.transaction.description}>{f.transaction.description}</span>
                            <span className="hidden font-mono text-[11px] text-text-dim md:inline">{f.reason} → {f.category}</span>
                            <span className="font-mono text-xs"><SecureValue value={f.transaction.amount} /></span>
                        </li>
                    ))}
                </ul>
            </details>
            {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
    );
}
