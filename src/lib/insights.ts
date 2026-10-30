import type { Transaction } from '../types';
import { formatCurrency, monthLabel, shiftMonth, todayISO } from './format';
import { merchantKey } from './import/text';
import { RESGATE } from './transfers';

const soma = (txs: Transaction[]) => txs.reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;
const despesas = (txs: Transaction[], mes: string) => txs.filter(t => t.type === 'expense' && t.date.slice(0, 7) === mes);
const centavos = (v: number) => Math.round(v * 100) / 100;
const diasNoMes = (mes: string) => { const [ano, numero] = mes.split('-').map(Number); return new Date(ano, numero, 0).getDate(); };

export function monthTotals(txs: Transaction[], month: string): { income: number; expense: number; invested: number; balance: number } {
    const itens = txs.filter(t => t.date.slice(0, 7) === month);
    const income = soma(itens.filter(t => t.type === 'income'));
    const expense = soma(itens.filter(t => t.type === 'expense'));
    // Investido líquido: aportes menos resgates (aplicar e resgatar no mesmo mês não é economia nem gasto)
    const invested = centavos(soma(itens.filter(t => t.type === 'investment')) - soma(itens.filter(t => t.type === 'transfer' && t.category === RESGATE)));
    return { income, expense, invested, balance: centavos(income - expense - invested) };
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
export function detectRecurring(txs: Transaction[], refMonth: string, type: 'expense' | 'income' = 'expense'): Recurring[] {
    const inicio = shiftMonth(refMonth, -5);
    const historico = txs.filter(t => t.type === type && t.date.slice(0, 7) <= refMonth);
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

const ALERTA_MINIMO = 50;
const ALERTA_CRITICO = 300;

export interface Alert { level: 'info' | 'warning' | 'critical'; title: string; detail: string }
export function buildAlerts(txs: Transaction[], month: string, today = todayISO()): Alert[] {
    const alertas: Alert[] = [];
    for (const c of categoryBreakdown(txs, month)) {
        // Variação percentual sobre valores pequenos é ruído: R$ 15 contra R$ 7 não merece alerta
        const diferenca = c.total - c.avgPrev;
        if (c.deltaPct !== null && c.deltaPct > 25 && diferenca >= ALERTA_MINIMO) alertas.push({ level: c.deltaPct > 60 && diferenca >= ALERTA_CRITICO ? 'critical' : 'warning',
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

export interface Commitment { label: string; category: string; amount: number }
export interface SpendingRoom {
    available: number; perDay: number; daysLeft: number;
    income: number; expense: number; invested: number;
    pendingBills: Commitment[]; pendingIncome: Commitment[];
}

// Recorrentes do mês anterior que ainda não apareceram neste mês
// Conta por ocorrência: duas contas Vivo no mês passado e uma paga neste mês deixa uma pendente
function pendentes(txs: Transaction[], month: string, type: 'expense' | 'income'): Commitment[] {
    const anterior = shiftMonth(month, -1);
    const doTipo = txs.filter(t => t.type === type);
    const resultado: Commitment[] = [];
    for (const r of detectRecurring(txs, anterior, type).filter(r => r.lastDate.slice(0, 7) === anterior)) {
        const parecidas = (mes: string) => doTipo.filter(t => t.date.slice(0, 7) === mes && merchantKey(t.rawDescription || t.description) === r.merchant
            && Math.abs(t.amount - r.avgAmount) <= r.avgAmount * 0.1 + 1e-8).length;
        const faltam = parecidas(anterior) - parecidas(month);
        for (let i = 0; i < faltam; i++) resultado.push({ label: r.label, category: r.category, amount: centavos(r.avgAmount) });
    }
    return resultado;
}

// Quanto ainda dá para gastar até o fim do mês sem fechar no vermelho:
// entradas − gastos − investido líquido − contas recorrentes que ainda vão cair + receitas recorrentes que ainda vão entrar
export function spendingRoom(txs: Transaction[], month: string, today = todayISO()): SpendingRoom {
    const { income, expense, invested } = monthTotals(txs, month);
    const pendingBills = pendentes(txs, month, 'expense');
    const pendingIncome = pendentes(txs, month, 'income');
    const total = (itens: Commitment[]) => itens.reduce((s, c) => s + c.amount, 0);
    const available = centavos(income - expense - invested - total(pendingBills) + total(pendingIncome));
    const ultimo = diasNoMes(month);
    const daysLeft = month === today.slice(0, 7) ? ultimo - Number(today.slice(8, 10)) + 1 : month > today.slice(0, 7) ? ultimo : 0;
    return { available, perDay: daysLeft && available > 0 ? centavos(available / daysLeft) : 0, daysLeft,
        income, expense, invested, pendingBills, pendingIncome };
}
