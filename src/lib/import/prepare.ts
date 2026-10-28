import type { CategorySource, Transaction, TransactionType } from '../../types';
import type { ParsedStatement } from './parse';
import { Classifier } from './classifier';
import { hashString, merchantKey, normalizeText, prettifyDescription } from './text';

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

export function prepareImport(statements: ParsedStatement[], classifier: Classifier, existing: Transaction[]): ImportRow[] {
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
            const p = classifier.predict(r.description, r.amount, s.kind);
            const duplicada = manuais.find(t => t.type === p.type && Math.round(t.amount * 100) === Math.abs(centavos)
                && Math.abs(Date.parse(t.date) - Date.parse(r.date)) <= 2 * 86400000);
            const status: RowStatus = hashes.has(key) ? 'exists' : duplicada ? 'possible-duplicate' : 'new';
            rows.push({ key, statementId: s.id, date: r.date, amount: Math.abs(centavos) / 100, signedAmount: r.amount,
                description: prettifyDescription(r.description), rawDescription: r.description, merchant: merchantKey(r.description),
                bank: s.bank, type: p.type, category: p.category, categorySource: p.source, confidence: p.confidence,
                status, ...(status === 'possible-duplicate' ? { duplicateOf: duplicada!.id } : {}), selected: status === 'new' });
        }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function toTransactionData(row: ImportRow): Omit<Transaction, 'id' | 'createdAt'> {
    return { date: row.date, amount: row.amount, description: row.description, type: row.type, category: row.category,
        source: 'import', importHash: row.key, bank: row.bank, rawDescription: row.rawDescription, categorySource: row.categorySource };
}
