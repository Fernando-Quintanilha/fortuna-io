// Utilitários de texto usados pelos parsers e pelo classificador.

// Bancos brasileiros ainda exportam muito em Windows-1252; tenta UTF-8 primeiro.
export async function decodeFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder('windows-1252').decode(buffer);
    }
}

export function stripAccents(s: string) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Prefixos genéricos que os bancos colocam antes do nome do estabelecimento
const PREFIXES = [
    /^compra (no|com) (cartao de )?(debito|credito)\s*[-:]?\s*/,
    /^compra cartao( (deb|cred))?\s*[-:]?\s*/,
    /^(transferencia|pix) (enviada|enviado|recebida|recebido)( pelo pix)?\s*[-:]?\s*/,
    /^pix (qrs?|qr code|transf|ted)\s*[-:]?\s*/,
    /^(pagamento|pagto|pgto) (de |do )?(boleto|titulo|conta)\s*[-:]?\s*/,
    /^debito automatico\s*[-:]?\s*/,
    /^(deb|cred|db|cr)\.?\s+(aut|autom)\.?\s*/,
    /^(ted|doc|tef)\s+(enviada|recebida|enviado|recebido)?\s*[-:]?\s*/,
    /^(pg|pag|pagseguro|mp|mercadopago|ifd|ifood|ec|pp|sumup|stone|cielo|zp|ebn)\s?\*\s*/,
];

// Texto "limpo" (minúsculo, sem acento, sem números soltos) — base para tokens
export function normalizeText(raw: string) {
    return stripAccents(raw.toLowerCase())
        .replace(/&amp;/g, '&')
        .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ')   // datas
        .replace(/\b\d{2}:\d{2}(:\d{2})?\b/g, ' ')           // horários
        .replace(/\bparc(ela)?\s*\d+\s*(\/|de)\s*\d+\b/g, ' ') // "parcela 2/10"
        .replace(/[^a-z0-9*\s]/g, ' ')
        .replace(/\b\d+\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Chave do estabelecimento: texto normalizado sem prefixos de banco, até 3 palavras
export function merchantKey(raw: string) {
    return merchantText(raw).split(' ').slice(0, 3).join(' ');
}

// Texto do estabelecimento completo: normalizado, sem prefixos de banco, palavras de 2+ letras
export function merchantText(raw: string) {
    let s = normalizeText(raw);
    for (const p of PREFIXES) s = s.replace(p, '');
    return s.replace(/\*/g, ' ').split(/\s+/).filter(w => w.length > 1).join(' ');
}

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'com', 'para', 'por', 'ltda', 'sa', 'me', 'eireli', 'br', 'brasil']);

export function tokenize(raw: string): string[] {
    return normalizeText(raw)
        .replace(/\*/g, ' ')
        .split(' ')
        .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

// Descrição legível para exibir: sem prefixo de banco, Title Case se vier tudo maiúsculo
export function prettifyDescription(raw: string) {
    let s = raw.replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    s = s.replace(/^(compra (no|com) (cart[aã]o de )?(d[eé]bito|cr[eé]dito)|transfer[eê]ncia (enviada|recebida)( pelo pix)?|pix (enviado|recebido))\s*[-:]\s*/i, '');
    if (s === s.toUpperCase()) {
        s = s.toLowerCase().replace(/(^|[\s*/-])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
    }
    return s || raw;
}

// Hash rápido e estável (cyrb53) para identificar transações importadas
export function hashString(str: string, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

// "1.234,56" | "-1234.56" | "R$ 1.234,56" | "(12,00)" | "12,00 D" -> número
export function parseAmount(input: string): number | null {
    let s = input.trim();
    if (!s || s.length > 40) return null;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
    const sufixo = s.slice(-1).toLowerCase();
    if (sufixo === 'd' || sufixo === 'c') {
        if (sufixo === 'd') negative = true;
        s = s.slice(0, -1).trimEnd();
    }
    s = s.replace(/[R$\s]/g, '');
    if (s.startsWith('-')) { negative = true; s = s.slice(1); }
    if (s.startsWith('+')) s = s.slice(1);
    if (s.endsWith('-')) { negative = true; s = s.slice(0, -1); }

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
        if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d+$/.test(s)) return null;
        s = s.replace(/\./g, '').replace(',', '.');           // padrão BR
    } else if (lastDot > lastComma && lastComma !== -1) {
        if (!/^\d{1,3}(?:,\d{3})+\.\d+$/.test(s)) return null;
        s = s.replace(/,/g, '');                              // 1,234.56
    }
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const value = Number(s);
    return Number.isFinite(value) ? (negative ? -value : value) : null;
}

// Aceita dd/mm/yyyy, dd/mm/yy, dd-mm-yyyy, yyyy-mm-dd, yyyymmdd -> 'YYYY-MM-DD'
export function parseDate(input: string): string | null {
    const s = input.trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/)
        || s.match(/^(\d{4})(\d{2})(\d{2})(?:$|\d|\[)/);
    const br = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:$|\s)/);
    if (!iso && !br) return null;
    const ano = iso ? Number(iso[1]) : Number(br![3].length === 2 ? `20${br![3]}` : br![3]);
    const mes = Number(iso ? iso[2] : br![2]);
    const dia = Number(iso ? iso[3] : br![1]);
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    if (ano < 100 || data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
    return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
