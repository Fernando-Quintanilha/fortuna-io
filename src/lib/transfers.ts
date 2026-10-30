// Movimentações entre as próprias contas não são receita nem gasto.
// Cada banco só enxerga a própria ponta; com todos os extratos juntos dá para reconhecer as duas.
import type { Transaction } from '../types';
import type { Identity } from './identity';
import { mentionsOwner, mentionsSomeoneElse } from './identity';
import { normalizeText } from './import/text';

export const ENTRE_CONTAS = 'Entre minhas contas';
export const RESGATE = 'Resgate de investimento';
// Só categorias genéricas podem virar par; "Mercado" de R$ 50 casando com um Pix recebido de R$ 50 seria falso positivo
export const GENERICAS = new Set(['Pix/Transferência', 'Pix recebido', 'Outros']);

export interface Movimento { id: string; signed: number; date: string; bank?: string }
const conhecido = (banco?: string) => Boolean(banco) && banco !== 'Desconhecido';

const casam = (s: Movimento, e: Movimento) => conhecido(e.bank) && conhecido(s.bank) && e.bank !== s.bank
    && Math.round(e.signed * 100) === Math.round(-s.signed * 100)
    && Math.abs(Date.parse(e.date) - Date.parse(s.date)) <= 2 * 86400000;

// Saída num banco + entrada de mesmo valor em outro banco, em até 2 dias.
// Só pareia quando o casamento é único dos dois lados: na dúvida, fica como está para o usuário decidir.
// Retorna id -> id do par.
export function pairTransfers(itens: Movimento[]): Map<string, string> {
    const pares = new Map<string, string>();
    const saidas = itens.filter(i => i.signed < 0);
    const entradas = itens.filter(i => i.signed > 0);
    for (const s of saidas) {
        const opcoes = entradas.filter(e => casam(s, e));
        if (opcoes.length !== 1) continue;
        const e = opcoes[0];
        if (saidas.filter(outra => casam(outra, e)).length !== 1) continue;
        pares.set(s.id, e.id).set(e.id, s.id);
    }
    return pares;
}

// Resgate é crédito; imposto ou tarifa sobre resgate é despesa
export function isRedemption(texto: string): boolean {
    const t = normalizeText(texto);
    return /\bresgate\b/.test(t) && !/\b(irrf|ir|iof|imposto|tarifa|taxa)\b/.test(t);
}

// pairId: as duas pontas de um par precisam ser gravadas juntas
export interface TransferFix { transaction: Transaction; category: string; reason: string; pairId?: string }

// Lançamentos já gravados que deveriam ser transferência. Nunca mexe no que o usuário escolheu.
export function findTransferFixes(txs: Transaction[], identity: Identity): TransferFix[] {
    const fixes: TransferFix[] = [];
    const vistos = new Set<string>();
    const automaticas = txs.filter(t => t.categorySource !== 'user' && t.source === 'import');
    for (const t of automaticas) {
        const texto = t.rawDescription || t.description;
        if (t.type === 'transfer' && t.category === ENTRE_CONTAS && isRedemption(texto)) {
            fixes.push({ transaction: t, category: RESGATE, reason: 'resgate de investimento' });
        } else if ((t.type === 'income' || t.type === 'expense') && mentionsOwner(texto, identity)) {
            fixes.push({ transaction: t, category: ENTRE_CONTAS, reason: 'Pix para você mesmo' });
        } else continue;
        vistos.add(t.id);
    }
    // CPF/CNPJ de outra pessoa na descrição veta o par: é pagamento ou recebimento de verdade
    const candidatos = automaticas.filter(t => !vistos.has(t.id) && (t.type === 'income' || t.type === 'expense')
        && GENERICAS.has(t.category) && !mentionsSomeoneElse(t.rawDescription || t.description, identity));
    const pares = pairTransfers(candidatos.map(t => ({ id: t.id, signed: t.type === 'income' ? t.amount : -t.amount, date: t.date, bank: t.bank })));
    for (const t of candidatos) {
        const par = pares.get(t.id);
        if (par) fixes.push({ transaction: t, category: ENTRE_CONTAS, reason: 'mesmo valor saiu de um banco e entrou em outro', pairId: [t.id, par].sort().join('|') });
    }
    return fixes.sort((a, b) => b.transaction.date.localeCompare(a.transaction.date));
}
