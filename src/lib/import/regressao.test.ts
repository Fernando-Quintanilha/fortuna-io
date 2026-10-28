import { describe, expect, it } from 'vitest';
import { Classifier } from './classifier';
import { parseStatementText } from './parse';
import { prepareImport } from './prepare';
import { parseAmount } from './text';

// Casos levantados na revisão adversarial do Codex
const c = Classifier.train([]);
const ofx = (conta: string) => parseStatementText(
    `<OFX><BANKID>260<ACCTID>${conta}<BANKTRANLIST><STMTTRN><DTPOSTED>20261005<TRNAMT>-30.00<FITID>X1<MEMO>Padaria</STMTTRN></BANKTRANLIST></OFX>`,
    `nu-${conta}.ofx`,
);

describe('regressões da revisão', () => {
    it('duas contas do mesmo banco com o mesmo FITID não colidem', () => {
        const rows = prepareImport([ofx('111'), ofx('222')], c, []);
        expect(rows).toHaveLength(2);
        expect(rows.every(r => r.status === 'new' && r.selected)).toBe(true);
    });

    it('extratos sobrepostos geram uma linha só (chave única na revisão)', () => {
        const rows = prepareImport([ofx('111'), ofx('111')], c, []);
        expect(rows).toHaveLength(1);
    });

    it('respeita coluna indicadora C/D e não trata como fatura', () => {
        const s = parseStatementText('Data;Descricao;Valor;Tipo\n01/10/2026;Salario;100,00;C\n02/10/2026;Mercado;50,00;D', 'conta.csv');
        expect(s.kind).toBe('checking');
        expect(s.rows.map(r => r.amount)).toEqual([100, -50]);
    });

    it('rejeita linha com colunas deslocadas por vírgula decimal sem aspas', () => {
        const s = parseStatementText('Data,Descricao,Valor,Saldo\n01/10/2026,Compra,-12,50,100\n02/10/2026,Outra,-5.00,95', 'x.csv');
        expect(s.rows).toEqual([{ date: '2026-10-02', amount: -5, description: 'Outra' }]);
        expect(s.warnings.join(' ')).toMatch(/ignorada/);
    });

    it('parseAmount é linear com espaços maliciosos', () => {
        const inicio = performance.now();
        expect(parseAmount('1' + ' '.repeat(64000) + '1')).toBeNull();
        expect(performance.now() - inicio).toBeLessThan(50);
    });

    it('OFX com muitas tags STMTTRN abertas não trava', () => {
        const inicio = performance.now();
        expect(() => parseStatementText('<OFX>' + '<STMTTRN '.repeat(50000), 'x.ofx')).not.toThrow();
        expect(performance.now() - inicio).toBeLessThan(500);
    });
});
