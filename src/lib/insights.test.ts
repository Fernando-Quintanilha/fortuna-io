import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { buildAlerts, categoryBreakdown, cumulativeDaily, detectRecurring, monthlySeries, monthTotals, spendingRoom, topMerchants } from './insights';

const tx = (date: string, amount: number, patch: Partial<Transaction> = {}): Transaction => ({ id: date, date, amount,
    description: 'Netflix', type: 'expense', category: 'Assinaturas', ...patch });

describe('relatórios', () => {
    it('calcula categorias, média de três meses incluindo vazios, variação e participação', () => {
        const txs = [tx('2026-07-01', 100), tx('2026-08-01', 100), tx('2026-09-01', 100), tx('2026-10-01', 150),
            tx('2026-10-02', 50, { category: 'Mercado' }), tx('2026-10-03', 999, { type: 'transfer' })];
        const [assinaturas, mercado] = categoryBreakdown(txs, '2026-10');
        expect(assinaturas).toMatchObject({ total: 150, count: 1, avgPrev: 100, deltaPct: 50, share: 0.75 });
        expect(mercado.deltaPct).toBeNull();
        expect(categoryBreakdown([tx('2026-09-01', 90), tx('2026-10-01', 60)], '2026-10')[0].avgPrev).toBe(30);
    });
    it('detecta Netflix recorrente em três meses e exclui outlier e meses futuros', () => {
        const txs = [tx('2026-08-01', 40), tx('2026-09-01', 42), tx('2026-10-01', 40), tx('2026-10-15', 400), tx('2026-11-01', 40)];
        const [r] = detectRecurring(txs, '2026-10');
        expect(r).toMatchObject({ merchant: 'netflix', months: 3, lastDate: '2026-10-01', isNew: false });
        expect(r.avgAmount).toBeCloseTo(122 / 3);
        expect(detectRecurring([tx('2026-09-01', 40), tx('2026-10-01', 40)], '2026-10')[0].isNew).toBe(true);
        expect(detectRecurring([tx('2026-10-01', 40), tx('2026-10-02', 40)], '2026-10')).toEqual([]);
    });
    it('preenche série cronológica vazia e ignora transfer em todos os relatórios', () => {
        const txs = [tx('2026-10-01', 1000, { type: 'transfer' })];
        expect(monthTotals(txs, '2026-10')).toEqual({ income: 0, expense: 0, invested: 0, balance: 0 });
        const serie = monthlySeries(txs, '2026-02', 3);
        expect(serie.map(p => p.month)).toEqual(['2025-12', '2026-01', '2026-02']);
        expect(serie.every(p => p.expense === 0 && p.income === 0)).toBe(true);
        expect(categoryBreakdown(txs, '2026-10')).toEqual([]); expect(topMerchants(txs, '2026-10')).toEqual([]);
        expect(detectRecurring(txs, '2026-10')).toEqual([]); expect(buildAlerts(txs, '2026-10', '2026-10-15')).toEqual([]);
    });
    it('acumula dias com limite de hoje e respeita fevereiro bissexto', () => {
        const pontos = cumulativeDaily([tx('2024-02-01', 10), tx('2024-02-03', 20), tx('2024-01-31', 50)], '2024-02', '2024-02-02');
        expect(pontos).toHaveLength(31);
        expect(pontos[1]).toEqual({ day: 2, current: 10, previous: 0 });
        expect(pontos[2].current).toBeNull(); expect(pontos[30].previous).toBe(50);
    });
    it('usa descrição mais recente e calcula saldo com investimentos', () => {
        const txs = [tx('2026-10-01', 10), tx('2026-10-02', 20, { description: 'NETFLIX' }),
            tx('2026-10-03', 100, { type: 'income' }), tx('2026-10-03', 15, { type: 'investment' })];
        expect(topMerchants(txs, '2026-10')[0]).toMatchObject({ label: 'NETFLIX', total: 30, count: 2 });
        expect(monthTotals(txs, '2026-10').balance).toBe(55);
    });
    it('emite alertas em português e não projeta lançamentos futuros', () => {
        const txs = [tx('2026-07-01', 1000), tx('2026-08-01', 1000), tx('2026-09-01', 1000), tx('2026-10-01', 1700)];
        const alertas = buildAlerts(txs, '2026-10', '2026-10-15');
        expect(alertas.map(a => a.level)).toEqual(['critical', 'warning', 'critical']);
        expect(alertas[0].detail).toContain('R$');
        expect(buildAlerts([tx('2026-10-30', 100)], '2026-10', '2026-10-01').some(a => a.title.includes('Projeção'))).toBe(false);
    });
});

describe('investido líquido e quanto dá pra gastar', () => {
    it('ignora aumento percentual sobre valor pequeno e só é crítico com diferença relevante', () => {
        const pequeno = [tx('2026-07-01', 5), tx('2026-08-01', 5), tx('2026-09-01', 10), tx('2026-10-01', 15)];
        expect(buildAlerts(pequeno, '2026-10', '2026-10-31').some(a => a.title.startsWith('Aumento'))).toBe(false);
        const medio = [tx('2026-09-01', 300), tx('2026-10-01', 200)];
        expect(buildAlerts(medio, '2026-10', '2026-10-31').find(a => a.title.startsWith('Aumento'))?.level).toBe('warning');
    });
    it('desconta resgates do investido: aplicar e resgatar no mesmo mês não pesa no saldo', () => {
        const txs = [tx('2026-10-01', 1000, { type: 'income', category: 'Salário' }),
            tx('2026-10-15', 2970, { type: 'investment', category: 'Renda Fixa' }),
            tx('2026-10-15', 2970, { type: 'transfer', category: 'Resgate de investimento' }),
            tx('2026-10-20', 500, { type: 'transfer', category: 'Resgate de investimento' })];
        expect(monthTotals(txs, '2026-10')).toEqual({ income: 1000, expense: 0, invested: -500, balance: 1500 });
    });
    it('desconta contas recorrentes que ainda não caíram e soma receitas recorrentes previstas', () => {
        const txs = [
            tx('2026-08-05', 3000, { type: 'income', category: 'Salário', description: 'Salario Empresa X' }),
            tx('2026-09-05', 3000, { type: 'income', category: 'Salário', description: 'Salario Empresa X' }),
            tx('2026-08-10', 120, { description: 'Vivo Fibra', category: 'Casa/Contas' }),
            tx('2026-09-10', 120, { description: 'Vivo Fibra', category: 'Casa/Contas' }),
            tx('2026-08-02', 40, { description: 'Netflix' }), tx('2026-09-02', 40, { description: 'Netflix' }),
            tx('2026-10-02', 40, { description: 'Netflix' }),
            tx('2026-10-03', 500, { type: 'income', category: 'Pix recebido', description: 'Freela' }),
            tx('2026-10-04', 200, { description: 'Mercado', category: 'Mercado' }),
        ];
        const room = spendingRoom(txs, '2026-10', '2026-10-22');
        expect(room.pendingBills.map(c => c.label)).toEqual(['Vivo Fibra']);
        expect(room.pendingIncome.map(c => c.amount)).toEqual([3000]);
        expect(room.available).toBe(500 - 240 - 120 + 3000);
        expect(room.daysLeft).toBe(10);
        expect(room.perDay).toBe(314);
        expect(spendingRoom(txs, '2026-09', '2026-10-22').daysLeft).toBe(0);
    });
});
