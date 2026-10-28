import { describe, expect, it } from 'vitest';
import { Classifier } from './classifier';
import { parseStatementText } from './parse';
import { prepareImport, toTransactionData } from './prepare';

const extrato = () => parseStatementText('Data;Descrição;Valor;Saldo\n01/10/2026;IFOOD;-20;100\n01/10/2026;IFOOD;-20;80', 'conta.csv');
const c = Classifier.train([]);
describe('preparo e deduplicação', () => {
    it('preserva compras idênticas e reconhece reimportação', () => {
        const rows = prepareImport([extrato()], c, []);
        expect(new Set(rows.map(r => r.key)).size).toBe(2);
        const salvas = rows.map(r => ({ ...toTransactionData(r), id: `usuario_${r.key}` }));
        expect(salvas[0]).toMatchObject({ source: 'import', amount: 20, rawDescription: 'IFOOD' });
        expect(prepareImport([extrato()], c, salvas).every(r => r.status === 'exists' && !r.selected)).toBe(true);
    });
    it('sinaliza manual parecido a dois dias, mas não a três dias', () => {
        const row = prepareImport([extrato()], c, [
            { id: 'manual', date: '2026-09-29', description: 'Jantar', amount: 20, type: 'expense', category: 'Alimentação' },
        ])[0];
        expect(row).toMatchObject({ status: 'possible-duplicate', duplicateOf: 'manual', selected: false });
        expect(prepareImport([extrato()], c, [{ ...toTransactionData(row), source: 'manual', id: 'm', importHash: undefined, date: '2026-09-28' }])[0].status).toBe('new');
    });
    it('não seleciona sobreposição entre arquivos e usa FITID independente da descrição', () => {
        expect(prepareImport([extrato(), extrato()], c, []).filter(r => r.selected)).toHaveLength(2);
        const s = extrato(); s.rows = [{ ...s.rows[0], fitId: 'banco-1' }];
        const primeiro = prepareImport([s], c, [])[0];
        s.rows[0].description = 'Texto alterado';
        expect(prepareImport([s], c, [])[0].key).toBe(primeiro.key);
    });
});
