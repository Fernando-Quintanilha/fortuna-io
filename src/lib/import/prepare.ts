import type { CategorySource, Transaction, TransactionType } from '../../types';
import type { ParsedStatement } from './parse';
import { Classifier } from './classifier';
import { hashString, merchantKey, normalizeText, prettifyDescription } from './text';
import type { Identity } from '../identity';
import { mentionsOwner, mentionsSomeoneElse } from '../identity';
import { ENTRE_CONTAS, GENERICAS, pairTransfers } from '../transfers';

export type RowStatus = 'new' | 'exists' | 'possible-duplicate';
export interface ImportRow {
    key: string;
    statementId: string;
    date: string; amount: number; signedAmount: number;
    description: string; rawDescription: string; merchant: string;
    bank: string;
    type: TransactionType; category: string; categorySource: CategorySource; confidence: number;
    status: RowStatus; duplicateOf?: string;
    selected: boolean;
}

export function prepareImport(statements: ParsedStatement[], classifier: Classifier, existing: Transaction[], identity: Identity = {}): ImportRow[] {
    const hashes = new Set(existing.map(t => t.importHash).filter(Boolean));
    const vistas = new Set<string>();
    const manuais = existing.filter(t => t.source !== 'import');
    const rows: ImportRow[] = [];
    for (const s of statements) {
        const ocorrencias = new Map<string, number>();
        for (const r of s.rows) {
            if (!Number.isFinite(r.amount) || Math.round(Math.abs(r.amount) * 100) === 0) continue;
            const centavos = Math.round(r.amount * 100);
            const conta = s.account ? `${s.account}|` : '';
            const base = `${s.bank}|${conta}${s.kind}|${r.date}|${centavos}|${normalizeText(r.description)}`;
            const ocorrencia = ocorrencias.get(base) ?? 0;
            ocorrencias.set(base, ocorrencia + 1);
            const key = hashString(r.fitId ? `${s.bank}|${conta}${s.kind}|fitid|${r.fitId}|${r.date}|${centavos}` : `${base}|${ocorrencia}`);
            // Mesma linha em dois arquivos do envio (extratos sobrepostos): mantém só a primeira
            if (vistas.has(key)) continue;
            vistas.add(key);
            let p = classifier.predict(r.description, r.amount, s.kind);
            // Pix/TED para o próprio CPF: o dinheiro só mudou de banco
            if ((p.type === 'income' || p.type === 'expense') && mentionsOwner(r.description, { ...identity, ...withHolder(s) })) {
                p = { type: 'transfer', category: ENTRE_CONTAS, source: 'rule', confidence: 0.95 };
            }
            const duplicada = manuais.find(t => t.type === p.type && Math.round(t.amount * 100) === Math.abs(centavos)
                && Math.abs(Date.parse(t.date) - Date.parse(r.date)) <= 2 * 86400000);
            const status: RowStatus = hashes.has(key) ? 'exists' : duplicada ? 'possible-duplicate' : 'new';
            rows.push({ key, statementId: s.id, date: r.date, amount: Math.abs(centavos) / 100, signedAmount: r.amount,
                description: prettifyDescription(r.description), rawDescription: r.description, merchant: merchantKey(r.description),
                bank: s.bank, type: p.type, category: p.category, categorySource: p.source, confidence: p.confidence,
                status, ...(status === 'possible-duplicate' ? { duplicateOf: duplicada!.id } : {}), selected: status === 'new' });
        }
    }
    marcarOutroFormato(rows, existing);
    // Saída num extrato e entrada no extrato de outro banco, no mesmo envio (CPF/CNPJ de terceiro veta)
    const candidatas = rows.filter(r => r.status === 'new' && (r.type === 'income' || r.type === 'expense')
        && (r.categorySource === 'fallback' || GENERICAS.has(r.category)) && !mentionsSomeoneElse(r.rawDescription, identity));
    const pares = pairTransfers(candidatas.map(r => ({ id: r.key, signed: r.signedAmount, date: r.date, bank: r.bank })));
    for (const r of candidatas) {
        if (pares.has(r.key)) Object.assign(r, { type: 'transfer', category: ENTRE_CONTAS, categorySource: 'rule', confidence: 0.85 });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
}

// O mesmo lançamento já importado de outro formato (ex.: CSV antes, PDF agora) tem outro importHash:
// mesma data, valor e direção no mesmo banco (ou banco desconhecido) vira "possível duplicata", desmarcada para revisão.
function marcarOutroFormato(rows: ImportRow[], existing: Transaction[]) {
    const chaves = new Set(rows.map(r => r.key));
    const livres = existing.filter(t => t.source === 'import' && t.importHash && !chaves.has(t.importHash));
    const usadas = new Set<string>();
    for (const r of rows) {
        if (r.status !== 'new') continue;
        const igual = livres.find(t => !usadas.has(t.id) && t.date === r.date && Math.round(t.amount * 100) === Math.round(r.amount * 100)
            && (t.type === 'transfer' || (t.type === 'income') === (r.signedAmount > 0))
            && (t.bank === r.bank || !t.bank || t.bank === 'Desconhecido'));
        if (!igual) continue;
        usadas.add(igual.id);
        Object.assign(r, { status: 'possible-duplicate', duplicateOf: igual.id, selected: false });
    }
}

// O titular informado no próprio extrato (PDF) vale para aquele arquivo mesmo sem identidade salva
function withHolder(s: ParsedStatement): Identity {
    return s.holder ? { name: s.holder.name, ...(s.holder.cpf ? { cpf: s.holder.cpf } : {}) } : {};
}

export function toTransactionData(row: ImportRow): Omit<Transaction, 'id' | 'createdAt'> {
    return { date: row.date, amount: row.amount, description: row.description, type: row.type, category: row.category,
        source: 'import', importHash: row.key, bank: row.bank, rawDescription: row.rawDescription, categorySource: row.categorySource };
}
