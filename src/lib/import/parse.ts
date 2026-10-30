import { decodeFile, hashString } from './text';
import { parseOfx } from './ofx';
import { parseCsv } from './csv';
import { parsePdf, readPdfItems } from './pdf';
import type { Holder, PdfItem } from './pdf';

export type StatementKind = 'checking' | 'card';
export interface RawTx { date: string; amount: number; description: string; fitId?: string }
export interface ParsedStatement {
    id: string;
    fileName: string;
    format: 'ofx' | 'csv' | 'pdf';
    bank: string;
    account?: string; // ACCTID do OFX: separa duas contas do mesmo banco
    holder?: Holder;  // titular, quando o extrato informa (PDF)
    kind: StatementKind;
    rows: RawTx[];
    warnings: string[];
    period: { from: string; to: string } | null;
}

function comPeriodo(id: string, fileName: string, format: ParsedStatement['format'], resultado: Omit<ParsedStatement, 'id' | 'fileName' | 'format' | 'period'>): ParsedStatement {
    const datas = resultado.rows.map(r => r.date).sort();
    return { id, fileName, format, ...resultado, period: datas.length ? { from: datas[0], to: datas[datas.length - 1] } : null };
}

export function parseStatementText(text: string, fileName: string): ParsedStatement {
    const format = /<OFX\b|<STMTTRN\b/i.test(text) ? 'ofx' : 'csv';
    const resultado = format === 'ofx' ? parseOfx(text, fileName) : parseCsv(text, fileName);
    return comPeriodo(hashString(`${fileName}|${text}`), fileName, format, resultado);
}

export function parseStatementPdf(paginas: PdfItem[][], fileName: string): ParsedStatement {
    const conteudo = paginas.map(p => p.map(i => `${Math.round(i.x)},${Math.round(i.y)},${i.str}`).join('\n')).join('\f');
    return comPeriodo(hashString(`${fileName}|${conteudo}`), fileName, 'pdf', parsePdf(paginas, fileName));
}

const LIMITE_BYTES = 5 * 1024 * 1024;

export async function parseStatement(file: File): Promise<ParsedStatement> {
    if (file.size > LIMITE_BYTES) throw new Error('Arquivo maior que 5 MB. Exporte um período menor.');
    const buffer = await file.arrayBuffer();
    if (new TextDecoder().decode(buffer.slice(0, 5)) === '%PDF-') return parseStatementPdf(await readPdfItems(buffer), file.name);
    return parseStatementText(await decodeFile(file), file.name);
}

export function invertStatement(s: ParsedStatement): ParsedStatement {
    return { ...s, kind: s.kind === 'card' ? 'checking' : 'card', rows: s.rows.map(r => ({ ...r, amount: -r.amount })) };
}
