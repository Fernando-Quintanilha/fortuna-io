import { useMemo, useRef, useState, DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileText, X, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Sparkles, LogIn, CreditCard, Landmark } from 'lucide-react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import { Panel } from '../components/ui/Panel';
import { PageHeader } from '../components/ui/PageHeader';
import { SecureValue } from '../components/SecureValue';
import { parseStatement, invertStatement, ParsedStatement } from '../lib/import/parse';
import { prepareImport, ImportRow } from '../lib/import/prepare';
import { categoriesFor, defaultCategory, TYPE_LABEL } from '../lib/categories';
import { formatDate } from '../lib/format';
import { signInWithGoogle } from '../services/auth';
import { CategorySource, TransactionType } from '../types';

type Override = Partial<Pick<ImportRow, 'type' | 'category' | 'categorySource' | 'selected'>>;
type Filter = 'all' | 'uncertain' | 'duplicates';

const ACCEPT = '.ofx,.csv,.txt,.pdf';

const SOURCE_BADGE: Record<CategorySource, { label: string; cls: string }> = {
    user: { label: 'você', cls: 'border-primary/40 bg-primary/10 text-primary' },
    learned: { label: 'aprendido', cls: 'border-accent/30 bg-accent/10 text-accent' },
    rule: { label: 'regra', cls: 'border-white/15 bg-white/5 text-text-muted' },
    community: { label: 'comunidade', cls: 'border-accent/30 bg-transparent text-accent' },
    fallback: { label: '? revisar', cls: 'border-warning/40 bg-warning/10 text-warning' },
};

// Tipos possíveis conforme a direção do dinheiro
const typesFor = (signed: number): TransactionType[] =>
    signed >= 0 ? ['income', 'transfer'] : ['expense', 'investment', 'transfer'];

export function Import() {
    const { user, transactions, classifier, identity, setIdentity, importTransactions } = useFinanceiro();
    const inputRef = useRef<HTMLInputElement>(null);

    const [statements, setStatements] = useState<ParsedStatement[]>([]);
    const [errors, setErrors] = useState<{ fileName: string; message: string }[]>([]);
    const [overrides, setOverrides] = useState<Record<string, Override>>({});
    const [filter, setFilter] = useState<Filter>('all');
    const [dragging, setDragging] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [imported, setImported] = useState<number | null>(null);

    // As linhas sugeridas são recalculadas; as edições do usuário ficam em `overrides`
    const rows = useMemo(() => {
        const base = prepareImport(statements, classifier, transactions, identity);
        return base.map(r => ({ ...r, ...overrides[r.key] }));
    }, [statements, classifier, transactions, identity, overrides]);

    const visibleRows = useMemo(() => rows.filter(r =>
        filter === 'all' ||
        (filter === 'uncertain' && r.status === 'new' && (r.categorySource === 'fallback' || r.confidence < 0.6)) ||
        (filter === 'duplicates' && r.status !== 'new')
    ), [rows, filter]);

    const stats = useMemo(() => {
        const selected = rows.filter(r => r.selected);
        return {
            selected: selected.length,
            spend: selected.filter(r => r.type === 'expense').reduce((a, r) => a + r.amount, 0),
            income: selected.filter(r => r.type === 'income').reduce((a, r) => a + r.amount, 0),
            uncertain: rows.filter(r => r.status === 'new' && (r.categorySource === 'fallback' || r.confidence < 0.6)).length,
            duplicates: rows.filter(r => r.status !== 'new').length,
            auto: rows.filter(r => r.categorySource !== 'fallback').length,
        };
    }, [rows]);

    async function handleFiles(files: FileList | File[]) {
        setParsing(true);
        setImported(null);
        const parsed: ParsedStatement[] = [];
        const failed: { fileName: string; message: string }[] = [];
        for (const file of Array.from(files)) {
            try {
                parsed.push(await parseStatement(file));
            } catch (e) {
                failed.push({ fileName: file.name, message: e instanceof Error ? e.message : 'Arquivo não reconhecido.' });
            }
        }
        // Ignora o mesmo arquivo (mesmo conteúdo) enviado duas vezes
        setStatements(prev => {
            const ids = new Set(prev.map(s => s.id));
            return [...prev, ...parsed.filter(p => !ids.has(p.id) && ids.add(p.id))];
        });
        setErrors(failed);
        setParsing(false);
        // O extrato em PDF traz o titular: guarda para reconhecer Pix entre as suas contas nos outros bancos
        const titular = parsed.find(p => p.holder?.cpf)?.holder;
        if (titular && !identity.cpf) setIdentity({ name: titular.name, cpf: titular.cpf });
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    }

    function patch(key: string, o: Override) {
        setOverrides(prev => ({ ...prev, [key]: { ...prev[key], ...o } }));
    }

    // Corrigir uma linha replica a escolha para o mesmo estabelecimento ainda não revisado
    function changeCategory(row: ImportRow, category: string, type = row.type) {
        setOverrides(prev => {
            const next = { ...prev };
            for (const r of rows) {
                const isTarget = r.key === row.key;
                const sameMerchant = row.merchant && r.merchant === row.merchant && r.categorySource !== 'user'
                    && typesFor(r.signedAmount).includes(type);
                if (isTarget || sameMerchant) {
                    next[r.key] = { ...next[r.key], type, category, categorySource: 'user' };
                }
            }
            return next;
        });
    }

    function removeStatement(id: string) {
        setStatements(prev => prev.filter(s => s.id !== id));
    }

    function toggleCard(id: string) {
        setStatements(prev => prev.map(s => (s.id === id ? invertStatement(s) : s)));
    }

    function setAllVisible(selected: boolean) {
        setOverrides(prev => {
            const next = { ...prev };
            for (const r of visibleRows) {
                if (r.status !== 'exists') next[r.key] = { ...next[r.key], selected };
            }
            return next;
        });
    }

    async function handleImport() {
        setProgress({ done: 0, total: stats.selected });
        try {
            const count = await importTransactions(rows, (done, total) => setProgress({ done, total }));
            setImported(count);
            setStatements([]);
            setOverrides({});
        } catch (e) {
            setErrors([{ fileName: 'Importação', message: e instanceof Error ? e.message : 'Falha ao gravar.' }]);
        } finally {
            setProgress(null);
        }
    }

    if (!user || user.isAnonymous) {
        return (
            <div className="animate-enter">
                <PageHeader eyebrow="importar" title="Importar extratos" />
                <Panel>
                    <div className="flex flex-col items-center gap-4 py-10 text-center">
                        <LogIn className="text-primary" size={28} />
                        <p className="text-text-muted">Entre com sua conta para importar e salvar seus extratos.</p>
                        <button onClick={signInWithGoogle} className="btn-primary">Entrar com Google</button>
                    </div>
                </Panel>
            </div>
        );
    }

    return (
        <div className="animate-enter space-y-6">
            <PageHeader
                eyebrow="importar"
                title="Importar extratos"
                subtitle="Suba os extratos do mês (OFX, CSV ou PDF da Nubank, de quantos bancos quiser). O Fortuna lê, categoriza, reconhece o que é transferência entre as suas contas e você só revisa."
            />

            {imported !== null && (
                <div className="glass flex items-center gap-4 border-success/30 p-5">
                    <CheckCircle2 className="shrink-0 text-success" size={24} />
                    <div className="flex-1">
                        <p className="font-medium">{imported} transações importadas.</p>
                        <p className="text-sm text-text-muted">Os relatórios já estão atualizados.</p>
                    </div>
                    <Link to="/insights" className="btn-primary">Ver relatórios</Link>
                </div>
            )}

            {/* 1 · Upload */}
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`glass group relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden border-dashed px-6 py-12 text-center transition-all
                    ${dragging ? 'border-primary/70 bg-primary/5' : 'hover:border-primary/40'}`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="hidden"
                    onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
                />
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-primary transition-transform group-hover:scale-105">
                    {parsing ? <Loader2 className="animate-spin" size={26} /> : <Upload size={26} />}
                </div>
                <p className="font-medium">Arraste os arquivos aqui ou clique para escolher</p>
                <p className="font-mono text-xs text-text-dim">.ofx · .csv · .pdf (conta Nubank) — Nubank, Itaú, Inter, Bradesco, BB, Santander, C6, Caixa…</p>
            </div>

            <details className="glass px-5 py-4 text-sm text-text-muted">
                <summary className="cursor-pointer font-mono text-xs uppercase tracking-wider text-text-muted">como exportar o extrato do meu banco?</summary>
                <ul className="mt-3 list-inside list-disc space-y-1.5">
                    <li>No app ou internet banking procure <b className="text-text-main">Extrato → Exportar</b> e escolha <b className="text-text-main">OFX</b> (preferido) ou CSV/Excel.</li>
                    <li>Para cartão de crédito, exporte a <b className="text-text-main">fatura</b> em OFX ou CSV.</li>
                    <li>PDF: por enquanto só o extrato da conta Nubank. Dos outros bancos, use OFX ou CSV.</li>
                    <li>Pagamentos de fatura, Pix para você mesmo e resgates viram “Transferência” e ficam fora dos totais. Suba todos os bancos juntos: quando o mesmo valor sai de um e entra no outro, o Fortuna junta as duas pontas.</li>
                </ul>
            </details>

            {errors.length > 0 && (
                <div className="space-y-2">
                    {errors.map((e, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4 text-sm">
                            <AlertTriangle className="mt-0.5 shrink-0 text-danger" size={16} />
                            <p><span className="font-mono text-text-main">{e.fileName}</span> <span className="text-text-muted">— {e.message}</span></p>
                        </div>
                    ))}
                </div>
            )}

            {statements.length > 0 && (
                <>
                    {/* Arquivos lidos */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {statements.map(s => (
                            <div key={s.id} className="glass p-4">
                                <div className="mb-3 flex items-start gap-3">
                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2 text-text-muted">
                                        {s.kind === 'card' ? <CreditCard size={16} /> : <Landmark size={16} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">{s.bank}</p>
                                        <p className="truncate font-mono text-[11px] text-text-dim" title={s.fileName}><FileText size={10} className="mr-1 inline" />{s.fileName}</p>
                                    </div>
                                    <button onClick={() => removeStatement(s.id)} title="Remover arquivo" className="rounded-lg p-1 text-text-dim hover:text-danger cursor-pointer">
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-muted">
                                    <span className="chip border-stroke">{s.format}</span>
                                    <span className="chip border-stroke">{s.kind === 'card' ? 'fatura cartão' : 'conta'}</span>
                                    <span>{s.rows.length} itens</span>
                                    {s.period && <span>· {formatDate(s.period.from)} → {formatDate(s.period.to)}</span>}
                                </div>
                                <button onClick={() => toggleCard(s.id)} className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-text-dim hover:text-primary cursor-pointer">
                                    <RefreshCw size={11} /> sinais trocados? marcar como {s.kind === 'card' ? 'conta' : 'fatura de cartão'}
                                </button>
                                {s.warnings.map((w, i) => <p key={i} className="mt-2 text-[11px] text-warning">{w}</p>)}
                            </div>
                        ))}
                    </div>

                    {/* 2 · Revisão */}
                    <Panel
                        title="revisar categorias"
                        action={
                            <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted">
                                <Sparkles size={12} className="text-primary" />
                                {stats.auto}/{rows.length} categorizadas · modelo treinado com {classifier.trainingSize}
                            </span>
                        }
                    >
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            {([
                                ['all', `todas · ${rows.length}`],
                                ['uncertain', `incertas · ${stats.uncertain}`],
                                ['duplicates', `já existem · ${stats.duplicates}`],
                            ] as const).map(([f, label]) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`chip cursor-pointer py-1 ${filter === f ? 'border-primary/50 bg-primary/10 text-primary' : 'border-stroke text-text-muted hover:text-text-main'}`}
                                >
                                    {label}
                                </button>
                            ))}
                            <span className="flex-1" />
                            <button onClick={() => setAllVisible(true)} className="font-mono text-[11px] text-text-muted hover:text-primary cursor-pointer">marcar todas</button>
                            <span className="text-text-dim">/</span>
                            <button onClick={() => setAllVisible(false)} className="font-mono text-[11px] text-text-muted hover:text-primary cursor-pointer">desmarcar</button>
                        </div>

                        <ul className="divide-y divide-white/[0.05]">
                            {visibleRows.map(r => {
                                const badge = SOURCE_BADGE[r.categorySource];
                                return (
                                    <li key={r.key} className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 py-3 md:grid-cols-[auto_88px_1fr_150px_170px_120px] ${r.selected ? '' : 'opacity-45'}`}>
                                        <input
                                            type="checkbox"
                                            aria-label="Importar esta linha"
                                            checked={r.selected && r.status !== 'exists'}
                                            disabled={r.status === 'exists'}
                                            title={r.status === 'exists' ? 'Já importada — edite pelo histórico' : undefined}
                                            onChange={e => patch(r.key, { selected: e.target.checked })}
                                            className="h-4 w-4 cursor-pointer accent-[#C6F135] disabled:cursor-not-allowed"
                                        />
                                        <span className="hidden font-mono text-xs text-text-muted md:block">{formatDate(r.date)}</span>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm" title={r.rawDescription}>{r.description}</p>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                <span className="font-mono text-[11px] text-text-dim md:hidden">{formatDate(r.date)}</span>
                                                <span className="font-mono text-[11px] text-text-dim">{r.bank}</span>
                                                <span className={`chip ${badge.cls}`}>
                                                    {badge.label}{r.categorySource === 'learned' && ` ${(r.confidence * 100).toFixed(0)}%`}
                                                </span>
                                                {r.status === 'exists' && <span className="chip border-white/15 text-text-dim">já importada</span>}
                                                {r.status === 'possible-duplicate' && <span className="chip border-warning/40 text-warning" title="Já existe um lançamento parecido (manual ou importado de outro arquivo)">possível duplicata</span>}
                                            </div>
                                        </div>
                                        <span className={`text-right font-mono text-sm md:order-last ${r.signedAmount >= 0 ? 'text-success' : 'text-text-main'}`}>
                                            <SecureValue value={r.amount} prefix={r.signedAmount >= 0 ? '+ R$ ' : '- R$ '} />
                                        </span>
                                        <select
                                            aria-label="Tipo"
                                            value={r.type}
                                            onChange={e => {
                                                const type = e.target.value as TransactionType;
                                                changeCategory(r, defaultCategory(type), type);
                                            }}
                                            className="input col-span-3 cursor-pointer px-2 py-1.5 text-xs md:col-span-1"
                                        >
                                            {typesFor(r.signedAmount).map(t => <option key={t} value={t} className="bg-card">{TYPE_LABEL[t]}</option>)}
                                        </select>
                                        <select
                                            aria-label="Categoria"
                                            value={r.category}
                                            onChange={e => changeCategory(r, e.target.value)}
                                            className={`input col-span-3 cursor-pointer px-2 py-1.5 text-xs md:col-span-1 ${r.categorySource === 'fallback' ? 'border-warning/40' : ''}`}
                                        >
                                            {categoriesFor(r.type).map(c => <option key={c.label} value={c.label} className="bg-card">{c.label}</option>)}
                                        </select>
                                    </li>
                                );
                            })}
                        </ul>
                        {visibleRows.length === 0 && (
                            <p className="py-8 text-center font-mono text-sm text-text-muted">&gt; nada neste filtro_</p>
                        )}
                    </Panel>

                    {/* 3 · Confirmar */}
                    <div className="glass sticky bottom-24 z-40 flex flex-col gap-4 border-primary/25 bg-card/90 p-4 md:bottom-4 md:flex-row md:items-center">
                        <div className="flex flex-1 flex-wrap gap-x-6 gap-y-1 font-mono text-sm">
                            <span><span className="text-text-muted">selecionadas </span>{stats.selected}</span>
                            <span><span className="text-text-muted">gastos </span><SecureValue value={stats.spend} /></span>
                            <span><span className="text-text-muted">entradas </span><SecureValue value={stats.income} /></span>
                        </div>
                        <button onClick={handleImport} disabled={!stats.selected || progress !== null} className="btn-primary min-w-56">
                            {progress
                                ? <><Loader2 className="animate-spin" size={16} /> Gravando {progress.done}/{progress.total}</>
                                : <>Importar {stats.selected} transações</>}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
