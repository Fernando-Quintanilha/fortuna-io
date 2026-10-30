import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { addDoc, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db, transactionsCollection } from '../services/firebase';
import type { FinancialSummary, Transaction } from '../types';
import { Classifier } from '../lib/import/classifier';
import { toTransactionData } from '../lib/import/prepare';
import type { ImportRow } from '../lib/import/prepare';
import { categoriesFor } from '../lib/categories';
import { parseDate } from '../lib/import/text';
import { loadIdentity, saveIdentity } from '../lib/identity';
import type { Identity } from '../lib/identity';

interface FinanceValue {
    user: User | null; transactions: Transaction[]; summary: FinancialSummary; loading: boolean;
    classifier: Classifier;
    // Titular (nome e CPF mascarado): reconhece Pix entre as próprias contas
    identity: Identity;
    setIdentity(identity: Identity): void;
    addTransaction(t: Omit<Transaction, 'id' | 'createdAt'>): Promise<void>;
    editTransaction(id: string, t: Partial<Transaction>): Promise<void>;
    deleteTransaction(id: string): Promise<void>;
    // Recategoriza em lote; cada grupo (ex.: as duas pontas de uma transferência) é gravado no mesmo commit
    recategorize(groups: { id: string; type: Transaction['type']; category: string }[][]): Promise<number>;
    importTransactions(rows: ImportRow[], onProgress?: (done: number, total: number) => void): Promise<number>;
}
const FinanceContext = createContext<FinanceValue | undefined>(undefined);

function validar(t: Omit<Transaction, 'id' | 'createdAt'>) {
    if (!Number.isFinite(t.amount) || t.amount <= 0 || Math.round(t.amount * 100) === 0) throw new Error('Informe um valor positivo válido.');
    if (parseDate(t.date) !== t.date) throw new Error('Informe uma data válida.');
    if (!['income', 'expense', 'investment', 'transfer'].includes(t.type)
        || !categoriesFor(t.type).some(c => c.label === t.category)) throw new Error('Categoria inválida para este tipo de lançamento.');
    if (typeof t.description !== 'string' || !t.description.trim()) throw new Error('Informe uma descrição.');
}

export function FinanceProvider({ children }: { children: ReactNode }): JSX.Element {
    const [user, setUser] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [operacoes, setOperacoes] = useState(0);
    const usuarioAtual = useRef<string | null>(null);
    const [identidadeSalva, setIdentidadeSalva] = useState<Identity>({});

    useEffect(() => {
        let cancelarExtrato: (() => void) | undefined;
        let versao = 0;
        const cancelarAuth = onAuthStateChanged(auth, u => {
            const atual = ++versao;
            cancelarExtrato?.();
            cancelarExtrato = undefined;
            usuarioAtual.current = u?.uid ?? null;
            setUser(u); setTransactions([]); setCarregando(Boolean(u));
            setIdentidadeSalva(u ? loadIdentity(u.uid) : {});
            if (!u) return;
            const q = query(transactionsCollection, where('uid', '==', u.uid), orderBy('date', 'desc'), orderBy('createdAt', 'desc'));
            cancelarExtrato = onSnapshot(q, snapshot => {
                if (atual !== versao) return;
                setTransactions(snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as Transaction));
                setCarregando(false);
            }, erro => {
                if (atual !== versao) return;
                setTransactions([]); setCarregando(false);
                console.error('Erro ao carregar lançamentos:', erro);
            });
        });
        return () => { versao++; usuarioAtual.current = null; cancelarAuth(); cancelarExtrato?.(); };
    }, []);

    const classifier = useMemo(() => Classifier.train(transactions), [transactions]);
    const identity = useMemo<Identity>(() => ({ ...identidadeSalva, name: identidadeSalva.name || user?.displayName || undefined }), [identidadeSalva, user]);
    function setIdentity(nova: Identity) {
        if (!user) return;
        saveIdentity(user.uid, nova);
        setIdentidadeSalva(nova);
    }
    const summary = useMemo<FinancialSummary>(() => {
        const resumo = { totalBalance: 0, totalIncome: 0, totalExpense: 0, totalInvested: 0 };
        for (const t of transactions) {
            const valor = Math.round(Number(t.amount) * 100);
            if (t.type === 'income') resumo.totalIncome += valor;
            if (t.type === 'expense') resumo.totalExpense += valor;
            if (t.type === 'investment') resumo.totalInvested += valor;
        }
        resumo.totalBalance = resumo.totalIncome - resumo.totalExpense - resumo.totalInvested;
        return { totalBalance: resumo.totalBalance / 100, totalIncome: resumo.totalIncome / 100,
            totalExpense: resumo.totalExpense / 100, totalInvested: resumo.totalInvested / 100 };
    }, [transactions]);

    function exigirUsuario(): string {
        if (!user || usuarioAtual.current !== user.uid || auth.currentUser?.uid !== user.uid) throw new Error('Entre na sua conta para salvar lançamentos.');
        return user.uid;
    }
    async function executar<T>(acao: () => Promise<T>): Promise<T> {
        setOperacoes(n => n + 1);
        try { return await acao(); } finally { setOperacoes(n => n - 1); }
    }
    async function addTransaction(t: Omit<Transaction, 'id' | 'createdAt'>): Promise<void> {
        const uid = exigirUsuario();
        const dados = { ...t, amount: Number(t.amount), source: 'manual' as const, categorySource: 'user' as const };
        validar(dados);
        await executar(async () => { await addDoc(transactionsCollection, { ...dados, uid, createdAt: serverTimestamp() }); });
    }
    function exigirTransacao(id: string): Transaction {
        exigirUsuario();
        const atual = transactions.find(t => t.id === id);
        if (!atual) throw new Error('Lançamento não encontrado nesta conta.');
        return atual;
    }
    async function editTransaction(id: string, t: Partial<Transaction>): Promise<void> {
        const atual = exigirTransacao(id);
        // Somente campos editáveis; identidade, origem e hash permanecem estáveis.
        const patch: Partial<Transaction> = {};
        if (t.description !== undefined) patch.description = t.description;
        if (t.date !== undefined) patch.date = t.date;
        if (t.amount !== undefined) patch.amount = Number(t.amount);
        if (t.category !== undefined) patch.category = t.category;
        if (t.type !== undefined) patch.type = t.type;
        // Correção feita pelo usuário vira treino; recategorização automática informa a própria origem
        if (t.category !== undefined || t.type !== undefined) patch.categorySource = t.categorySource ?? 'user';
        validar({ ...atual, ...patch });
        if (!Object.keys(patch).length) return;
        await executar(() => updateDoc(doc(db, 'transactions', id), { ...patch }));
    }
    async function recategorize(groups: { id: string; type: Transaction['type']; category: string }[][]): Promise<number> {
        const uid = exigirUsuario();
        const grupos = groups.map(g => g.map(item => {
            const atual = exigirTransacao(item.id);
            validar({ ...atual, type: item.type, category: item.category });
            return item;
        }));
        if (grupos.some(g => g.length > 450)) throw new Error('Grupo grande demais para gravar de uma vez.');
        const lotes: typeof grupos[] = [];
        for (const g of grupos) {
            const ultimo = lotes[lotes.length - 1];
            if (ultimo && ultimo.flat().length + g.length <= 450) ultimo.push(g); else lotes.push([g]);
        }
        return executar(async () => {
            let feitos = 0;
            for (const lote of lotes) {
                if (exigirUsuario() !== uid) throw new Error('A conta mudou durante a correção.');
                const batch = writeBatch(db);
                // 'rule': correção automática não vira treino do modelo
                for (const item of lote.flat()) batch.update(doc(db, 'transactions', item.id), { type: item.type, category: item.category, categorySource: 'rule' });
                await batch.commit();
                feitos += lote.flat().length;
            }
            return feitos;
        });
    }
    async function deleteTransaction(id: string): Promise<void> {
        exigirTransacao(id);
        await executar(() => deleteDoc(doc(db, 'transactions', id)));
    }
    async function importTransactions(rows: ImportRow[], onProgress?: (done: number, total: number) => void): Promise<number> {
        const uid = exigirUsuario();
        // Nunca sobrescreve um lançamento já importado (o usuário pode tê-lo corrigido depois)
        const jaGravadas = new Set(transactions.map(t => t.importHash).filter(Boolean));
        const selecionadas = [...new Map(rows.filter(r => r.selected && !jaGravadas.has(r.key)).map(r => [r.key, r])).values()];
        const dados = selecionadas.map(r => {
            if (!/^[a-f0-9]{16}$/.test(r.key)) throw new Error('Identificador de importação inválido.');
            const t = toTransactionData(r); validar(t); return t;
        });
        return executar(async () => {
            let done = 0;
            onProgress?.(done, dados.length);
            for (let i = 0; i < dados.length; i += 450) {
                if (exigirUsuario() !== uid) throw new Error('A conta mudou durante a importação.');
                const lote = writeBatch(db);
                const parte = dados.slice(i, i + 450);
                for (const t of parte) lote.set(doc(db, 'transactions', `${uid}_${t.importHash}`), { ...t, uid, createdAt: serverTimestamp() });
                await lote.commit();
                done += parte.length;
                onProgress?.(done, dados.length);
            }
            return done;
        });
    }
    return <FinanceContext.Provider value={{ user, transactions, summary, loading: carregando || operacoes > 0,
        classifier, identity, setIdentity, addTransaction, editTransaction, deleteTransaction, recategorize, importTransactions }}>{children}</FinanceContext.Provider>;
}

export function useFinanceContext(): FinanceValue {
    const context = useContext(FinanceContext);
    if (!context) throw new Error('useFinanceContext deve ser usado dentro de FinanceProvider.');
    return context;
}
