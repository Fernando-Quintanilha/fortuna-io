import { decodeFile, hashString } from './text';
import { parseOfx } from './ofx';
import { parseCsv } from './csv';

export type StatementKind = 'checking' | 'card';
export interface RawTx { date: string; amount: number; description: string; fitId?: string }
export interface ParsedStatement {
    id: string;
    fileName: string;
    format: 'ofx' | 'csv';
    bank: string;
    account?: string; // ACCTID do OFX: separa duas contas do mesmo banco
    kind: StatementKind;
    rows: RawTx[];
    warnings: string[];
    period: { from: string; to: string } | null;
}

export function parseStatementText(text: string, fileName: string): ParsedStatement {
    const format = /<OFX\b|<STMTTRN\b/i.test(text) ? 'ofx' : 'csv';
    const resultado = format === 'ofx' ? parseOfx(text, fileName) : parseCsv(text, fileName);
    const datas = resultado.rows.map(r => r.date).sort();
    return {
        id: hashString(`${fileName}|${text}`), fileName, format, ...resultado,
        period: datas.length ? { from: datas[0], to: datas[datas.length - 1] } : null,
    };
}

const LIMITE_BYTES = 5 * 1024 * 1024;

export async function parseStatement(file: File): Promise<ParsedStatement> {
    if (file.size > LIMITE_BYTES) throw new Error('Arquivo maior que 5 MB. Exporte um período menor.');
    return parseStatementText(await decodeFile(file), file.name);
}

export function invertStatement(s: ParsedStatement): ParsedStatement {
    return { ...s, kind: s.kind === 'card' ? 'checking' : 'card', rows: s.rows.map(r => ({ ...r, amount: -r.amount })) };
}
