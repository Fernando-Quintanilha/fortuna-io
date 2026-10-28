import type { Transaction } from '../types';
import { formatCurrency, monthLabel, shiftMonth, todayISO } from './format';
import { merchantKey } from './import/text';

const soma = (txs: Transaction[]) => txs.reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;
const despesas = (txs: Transaction[], mes: string) => txs.filter(t => t.type === 'expense' && t.date.slice(0, 7) === mes);
const diasNoMes = (mes: string) => { const [ano, numero] = mes.split('-').map(Number); return new Date(ano, numero, 0).getDate(); };

export function monthTotals(txs: Transaction[], month: string): { income: number; expense: number; invested: number; balance: number } {
    const itens = txs.filter(t => t.date.slice(0, 7) === month);
    const income = soma(itens.filter(t => t.type === 'income'));
    const expense = soma(itens.filter(t => t.type === 'expense'));
    const invested = soma(itens.filter(t => t.type === 'investment'));
    return { income, expense, invested, balance: Math.round((income - expense - invested) * 100) / 100 };
}

export interface CategoryStat { category: string; total: number; count: number; avgPrev: number; deltaPct: number | null; share: number }
export function categoryBreakdown(txs: Transaction[], month: string): CategoryStat[] {
    const atuais = despesas(txs, month);
    const totalMes = soma(atuais);
    const anteriores = [1, 2, 3].flatMap(i => despesas(txs, shiftMonth(month, -i)));
    return [...new Set(atuais.map(t => t.category))].map(category => {
        const itens = atuais.filter(t => t.category === category);
        const total = soma(itens);
        const avgPrev = soma(anteriores.filter(t => t.category === category)) / 3;
        return { category, total, count: itens.length, avgPrev, deltaPct: avgPrev ? (total / avgPrev - 1) * 100 : null, share: totalMes ? total / totalMes : 0 };
    }).sort((a, b) => b.total - a.total);
}

export interface MerchantStat { merchant: string; label: string; category: string; total: number; count: number }
function agrupar(txs: Transaction[]): Map<string, Transaction[]> {
    const grupos = new Map<string, Transaction[]>();
    for (const t of txs) {
        const chave = merchantKey(t.rawDescription || t.description);
        if (!chave) continue;
        const grupo = grupos.get(chave) ?? [];
        grupo.push(t); grupos.set(chave, grupo);
    }
    return grupos;
}

export function topMerchants(txs: Transaction[], month: string, limit = 8): MerchantStat[] {
    return [...agrupar(despesas(txs, month))].map(([merchant, itens]) => {
        const recente = [...itens].sort((a, b) => b.date.localeCompare(a.date))[0];
        return { merchant, label: recente.description, category: recente.category, total: soma(itens), count: itens.length };
    }).sort((a, b) => b.total - a.total).slice(0, Math.max(0, limit));
}

export interface MonthPoint { month: string; label: string; income: number; expense: number }
export function monthlySeries(txs: Transaction[], endMonth: string, months = 6): MonthPoint[] {
    return Array.from({ length: Math.max(0, months) }, (_, i) => {
        const month = shiftMonth(endMonth, i - months + 1);
        const { income, expense } = monthTotals(txs, month);
        return { month, label: monthLabel(month, 'short'), income, expense };
    });
}

export interface DailyPoint { day: number; current: number | null; previous: number | null }
export function cumulativeDaily(txs: Transaction[], month: string, today = todayISO()): DailyPoint[] {
    const anterior = shiftMonth(month, -1);
    const atuais = despesas(txs, month), anteriores = despesas(txs, anterior);
    const ultimoAtual = diasNoMes(month), ultimoAnterior = diasNoMes(anterior);
    return Array.from({ length: Math.max(ultimoAtual, ultimoAnterior) }, (_, i) => {
        const day = i + 1;
        return { day,
            current: day > ultimoAtual || (month === today.slice(0, 7) && day > Number(today.slice(8, 10))) ? null : soma(atuais.filter(t => Number(t.date.slice(8, 10)) <= day)),
            previous: day > ultimoAnterior ? null : soma(anteriores.filter(t => Number(t.date.slice(8, 10)) <= day)),
        };
    });
}

export interface Recurring { merchant: string; label: string; category: string; avgAmount: number; months: number; lastDate: string; isNew: boolean }
export function detectRecurring(txs: Transaction[], refMonth: string): Recurring[] {
    const inicio = shiftMonth(refMonth, -5);
    const historico = txs.filter(t => t.type === 'expense' && t.date.slice(0, 7) <= refMonth);
    const primeira = new Map([...agrupar(historico)].map(([key, itens]) => [key, itens.map(t => t.date).sort()[0]]));
    const resultado: Recurring[] = [];
    for (const [merchant, itens] of agrupar(historico.filter(t => t.date.slice(0, 7) >= inicio))) {
        const valores = itens.map(t => t.amount).sort((a, b) => a - b);
        const meio = Math.floor(valores.length / 2);
        const mediana = valores.length % 2 ? valores[meio] : (valores[meio - 1] + valores[meio]) / 2;
        const regulares = itens.filter(t => Math.abs(t.amount - mediana) <= mediana * 0.1 + 1e-8);
        const months = new Set(regulares.map(t => t.date.slice(0, 7))).size;
        if (months < 2) continue;
        const recente = [...regulares].sort((a, b) => b.date.localeCompare(a.date))[0];
        resultado.push({ merchant, label: recente.description, category: recente.category, avgAmount: soma(regulares) / regulares.length,
            months, lastDate: recente.date, isNew: primeira.get(merchant)!.slice(0, 7) >= shiftMonth(refMonth, -1) });
    }
    return resultado.sort((a, b) => b.avgAmount - a.avgAmount);
}

export interface Alert { level: 'info' | 'warning' | 'critical'; title: string; detail: string }
export function buildAlerts(txs: Transaction[], month: string, today = todayISO()): Alert[] {
    const alertas: Alert[] = [];
    for (const c of categoryBreakdown(txs, month)) {
        if (c.deltaPct !== null && c.deltaPct > 25) alertas.push({ level: c.deltaPct > 60 ? 'critical' : 'warning',
            title: `Aumento em ${c.category}`, detail: `Gasto de ${formatCurrency(c.total)}, ${c.deltaPct.toFixed(0)}% acima da média de ${formatCurrency(c.avgPrev)} dos três meses anteriores.` });
    }
    for (const r of detectRecurring(txs, month).filter(r => r.isNew)) {
        alertas.push({ level: 'info', title: 'Novo gasto recorrente', detail: `${r.label}: média de ${formatCurrency(r.avgAmount)} por lançamento.` });
    }
    const totais = monthTotals(txs, month);
    if (month === today.slice(0, 7)) {
        const gastoAteHoje = soma(despesas(txs, month).filter(t => t.date <= today));
        const projecao = gastoAteHoje / Number(today.slice(8, 10)) * diasNoMes(month);
        const media = [1, 2, 3].reduce((s, i) => s + monthTotals(txs, shiftMonth(month, -i)).expense, 0) / 3;
        if (projecao > media) alertas.push({ level: 'warning', title: 'Projeção de gastos acima da média',
            detail: `Neste ritmo, o mês chegará a ${formatCurrency(projecao)} em despesas; a média anterior é ${formatCurrency(media)}.` });
    }
    if (totais.expense > totais.income) alertas.push({ level: 'critical', title: 'Gastos maiores que a receita',
        detail: `Despesas de ${formatCurrency(totais.expense)} superam a receita de ${formatCurrency(totais.income)} neste mês.` });
    return alertas;
}
