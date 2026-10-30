import { useMemo, useState } from 'react';
import { Brain, Loader2, Wand2, Eye, EyeOff, UserRound } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { usePrivacy } from '../contexts/PrivacyContext';
import { Panel } from '../components/ui/Panel';
import { PageHeader } from '../components/ui/PageHeader';
import { iconFor, TYPE_LABEL } from '../lib/categories';
import { StatementKind } from '../lib/import/parse';
import { normalizeCpf } from '../lib/identity';

export function Settings() {
    const { transactions, classifier, editTransaction, identity, setIdentity } = useFinanceiro();
    const [nome, setNome] = useState(identity.name ?? '');
    const [cpf, setCpf] = useState(identity.cpf ? `•••.${identity.cpf.slice(0, 3)}.${identity.cpf.slice(3)}-••` : '');
    const [identidadeMsg, setIdentidadeMsg] = useState<string | null>(null);

    function salvarIdentidade() {
        const digitos = cpf.trim() ? normalizeCpf(cpf) : undefined;
        if (cpf.trim() && !digitos) { setIdentidadeMsg('Informe o CPF completo ou os 6 dígitos do meio.'); return; }
        setIdentity({ ...(nome.trim() ? { name: nome.trim() } : {}), ...(digitos ? { cpf: digitos } : {}) });
        setIdentidadeMsg('Salvo. O painel vai apontar o que é transferência entre as suas contas.');
    }
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

            <Panel title="quem é você">
                <p className="mb-4 max-w-2xl text-sm text-text-muted">
                    <UserRound size={14} className="mr-1.5 inline text-primary" />
                    Com seu nome completo e CPF o Fortuna reconhece Pix e TED entre as suas próprias contas, que não são receita nem gasto.
                    Fica só neste navegador, e do CPF guardamos apenas os 6 dígitos do meio (os que os bancos mostram no extrato).
                    O extrato em PDF da Nubank preenche isso sozinho.
                </p>
                <div className="flex flex-col gap-3 md:flex-row">
                    <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo como aparece no banco" aria-label="Nome completo" className="input flex-1" />
                    <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="CPF" aria-label="CPF" inputMode="numeric" className="input md:w-56" />
                    <button onClick={salvarIdentidade} className="btn-primary">Salvar</button>
                </div>
                {identidadeMsg && <p className="mt-2 font-mono text-xs text-text-muted">&gt; {identidadeMsg}</p>}
            </Panel>

            <Panel
                title="modelo de categorização"
                action={<span className="font-mono text-[11px] text-text-muted">treinado com {classifier.trainingSize} exemplos</span>}
            >
                <p className="mb-5 max-w-2xl text-sm text-text-muted">
                    <Brain size={14} className="mr-1.5 inline text-primary" />
                    O modelo roda no seu navegador, sem custo e sem enviar dados para fora. Ele aprende toda vez que você
                    escolhe ou corrige uma categoria — na importação, no histórico ou ao lançar algo manualmente.
                    Ele já vem com uma base de <span className="font-mono text-text-main">{classifier.seedSize}</span> estabelecimentos
                    e serviços comuns no Brasil; qualquer correção sua passa na frente dela.
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
