import type { RawTx, StatementKind } from './parse';
import { bankFromCode, bankFromText } from './banks';
import { parseAmount, parseDate } from './text';

function entidades(texto: string): string {
    const nomes: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    return texto.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (original, entidade: string) => {
        if (!entidade.startsWith('#')) return nomes[entidade.toLowerCase()] ?? original;
        const codigo = entidade[1].toLowerCase() === 'x' ? parseInt(entidade.slice(2), 16) : Number(entidade.slice(1));
        return codigo <= 0x10ffff && !(codigo >= 0xd800 && codigo <= 0xdfff) ? String.fromCodePoint(codigo) : original;
    });
}

export function parseOfx(texto: string, arquivo: string): { bank: string; account?: string; kind: StatementKind; rows: RawTx[]; warnings: string[] } {
    const campo = (bloco: string, nome: string) => entidades(bloco.match(new RegExp(`<${nome}\\b[^>]*>\\s*([^<\\r\\n]*)`, 'i'))?.[1].trim() ?? '');
    const bank = bankFromCode(campo(texto, 'BANKID')) || bankFromText(campo(texto, 'ORG'))
        || bankFromCode(campo(texto, 'FID')) || bankFromText(campo(texto, 'FID')) || bankFromText(arquivo) || 'Desconhecido';
    const kind = /<(CREDITCARDMSGSRSV1|CCSTMTRS)\b/i.test(texto) ? 'card' : 'checking';
    const account = campo(texto, 'ACCTID') || undefined;
    const rows: RawTx[] = [];
    let ignoradas = 0;
    for (const trecho of texto.split(/<STMTTRN>/i).slice(1)) {
        const bloco = trecho.split(/<\/STMTTRN\s*>|<\/BANKTRANLIST\s*>/i)[0];
        const date = parseDate(campo(bloco, 'DTPOSTED').slice(0, 8));
        const amount = parseAmount(campo(bloco, 'TRNAMT'));
        if (!date || amount === null || Math.round(Math.abs(amount) * 100) === 0) { ignoradas++; continue; }
        const nome = campo(bloco, 'NAME');
        const memo = campo(bloco, 'MEMO');
        const description = nome && memo && nome !== memo ? `${nome} - ${memo}` : nome || memo || 'Sem descrição';
        const fitId = campo(bloco, 'FITID');
        rows.push({ date, amount, description, ...(fitId ? { fitId } : {}) });
    }
    return { bank, account, kind, rows, warnings: ignoradas ? [`${ignoradas} lançamento(s) ignorado(s) por data ou valor inválido ou zerado.`] : [] };
}
