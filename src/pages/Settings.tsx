import { useMemo, useState } from 'react';
import { Brain, Loader2, Wand2, Eye, EyeOff } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { usePrivacy } from '../contexts/PrivacyContext';
import { Panel } from '../components/ui/Panel';
import { PageHeader } from '../components/ui/PageHeader';
import { iconFor, TYPE_LABEL } from '../lib/categories';
import { StatementKind } from '../lib/import/parse';

export function Settings() {
    const { transactions, classifier, editTransaction } = useFinanceiro();
    const { isVisible, toggleVisibility } = usePrivacy();
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<number | null>(null);

    const learned = useMemo(() => classifier.learnedMerchants(), [classifier]);

    // Transações que caíram em "Outros" automaticamente e que o modelo atual já sabe classificar
    const candidates = useMemo(() => transactions
        .filter(t => t.source === 'import' && t.categorySource === 'fallback')
        .map(t => {
            const signed = t.type === 'income' ? t.amount : -t.amount;
            const kind: StatementKind = 'checking';
            return { t, p: classifier.predict(t.rawDescription ?? t.description, signed, kind) };
        })
        .filter(({ t, p }) => p.source !== 'fallback' && (p.category !== t.category || p.type !== t.type)),
    [transactions, classifier]);

    async function recategorize() {
        setRunning(true);
        // categorySource segue o modelo (não 'user'), então não reforça o próprio palpite
        for (const { t, p } of candidates) {
            await editTransaction(t.id, { type: p.type, category: p.category, categorySource: p.source });
        }
        setResult(candidates.length);
        setRunning(false);
    }

    return (
        <div className="animate-enter space-y-6">
            <PageHeader eyebrow="ajustes" title="Ajustes" subtitle="Privacidade e o que o Fortuna já aprendeu com você." />

            <Panel title="privacidade">
                <button onClick={toggleVisibility} className="btn-ghost">
                    {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    {isVisible ? 'Ocultar valores na tela' : 'Mostrar valores'}
                </button>
            </Panel>

            <Panel
                title="modelo de categorização"
                action={<span className="font-mono text-[11px] text-text-muted">treinado com {classifier.trainingSize} exemplos</span>}
            >
                <p className="mb-5 max-w-2xl text-sm text-text-muted">
                    <Brain size={14} className="mr-1.5 inline text-primary" />
                    O modelo roda no seu navegador, sem custo e sem enviar dados para fora. Ele aprende toda vez que você
                    escolhe ou corrige uma categoria — na importação, no histórico ou ao lançar algo manualmente.
                </p>

                <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-stroke bg-bg/40 p-4">
                    <Wand2 size={16} className="text-primary" />
                    <p className="flex-1 text-sm">
                        <span className="font-mono text-primary">{candidates.length}</span> transações em “Outros” podem ser recategorizadas com o que o modelo já sabe.
                    </p>
                    <button onClick={recategorize} disabled={!candidates.length || running} className="btn-primary">
                        {running ? <Loader2 size={16} className="animate-spin" /> : 'Recategorizar'}
                    </button>
                    {result !== null && <p className="w-full font-mono text-xs text-success">&gt; {result} transações atualizadas</p>}
                </div>

                <p className="label-mono mb-3">estabelecimentos memorizados · {learned.length}</p>
                {learned.length === 0 ? (
                    <p className="font-mono text-sm text-text-muted">&gt; nada ainda — corrija algumas categorias na importação_</p>
                ) : (
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {learned.slice(0, 60).map(m => {
                            const Icon = iconFor(m.category);
                            return (
                                <li key={m.key} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                                    <Icon size={14} className="shrink-0 text-text-muted" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-mono text-xs">{m.key}</p>
                                        <p className="truncate text-[11px] text-text-dim">{TYPE_LABEL[m.type]} → {m.category}</p>
                                    </div>
                                    <span className="font-mono text-[10px] text-text-dim">{m.count}x</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Panel>
        </div>
    );
}
