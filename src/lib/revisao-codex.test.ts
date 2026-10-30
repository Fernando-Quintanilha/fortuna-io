import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { mentionsOwner } from './identity';
import { findTransferFixes } from './transfers';
import { monthTotals, spendingRoom } from './insights';
import { Classifier } from './import/classifier';
import { parseStatementPdf, parseStatementText } from './import/parse';
import { prepareImport } from './import/prepare';
import type { PdfItem } from './import/pdf';

// Casos levantados na revisão adversarial do Codex (2026-10-30)
const eu = { name: 'Maria Teste da Silva', cpf: '123456' };
const base = { source: 'import' as const, categorySource: 'rule' as const };
const c = Classifier.train([]);

describe('revisão do Codex', () => {
    it('Pix de mesmo valor para terceiros com CPF/CNPJ em bancos diferentes não vira transferência', () => {
        const txs: Transaction[] = [
            { id: '1', date: '2026-10-07', amount: 300, type: 'expense', category: 'Pix/Transferência', description: 'x', rawDescription: 'Pix enviado - João Exemplo - •••.999.888-••', bank: 'Itaú', ...base },
            { id: '2', date: '2026-10-07', amount: 300, type: 'income', category: 'Pix recebido', description: 'x', rawDescription: 'Pix recebido - Loja X - 11.222.333/0001-44', bank: 'Nubank', ...base },
        ];
        expect(findTransferFixes(txs, eu)).toEqual([]);
        const ofx = (banco: string, valor: string, memo: string) => parseStatementText(
            `<OFX><BANKID>${banco}<ACCTID>1<BANKTRANLIST><STMTTRN><DTPOSTED>20261007<TRNAMT>${valor}<FITID>F<MEMO>${memo}</STMTTRN></BANKTRANLIST></OFX>`, `${banco}.ofx`);
        const rows = prepareImport([ofx('341', '-300.00', 'PIX ENVIADO JOAO ***.999.888-**'), ofx('260', '300.00', 'PIX RECEBIDO ANA ***.777.666-**')], c, [], eu);
        expect(rows.every(r => r.type !== 'transfer')).toBe(true);
    });

    it('pares corrigidos carregam o mesmo pairId para serem gravados juntos', () => {
        const txs: Transaction[] = [
            { id: 'a', date: '2026-10-07', amount: 300, type: 'expense', category: 'Pix/Transferência', description: 'Pix enviado', bank: 'Itaú', ...base },
            { id: 'b', date: '2026-10-07', amount: 300, type: 'income', category: 'Pix recebido', description: 'Pix recebido', bank: 'Nubank', ...base },
        ];
        const fixes = findTransferFixes(txs, eu);
        expect(fixes.map(f => f.pairId)).toEqual(['a|b', 'a|b']);
    });

    it('IRRF sobre resgate é imposto, e só crédito é resgate', () => {
        expect(c.predict('IRRF SOBRE RESGATE CDB', -15, 'checking')).toMatchObject({ type: 'expense', category: 'Taxas/Impostos' });
        expect(c.predict('RESGATE CDB', 1000, 'checking')).toMatchObject({ type: 'transfer', category: 'Resgate de investimento' });
        expect(c.predict('RESGATE CDB', -1000, 'checking').category).not.toBe('Resgate de investimento');
        const legado: Transaction = { id: '9', date: '2026-10-01', amount: 15, type: 'transfer', category: 'Entre minhas contas', description: 'IRRF sobre resgate CDB', bank: 'Itaú', ...base };
        expect(findTransferFixes([legado], eu)).toEqual([]);
        const txs: Transaction[] = [
            { id: '1', date: '2026-10-01', amount: 1000, type: 'transfer', category: 'Resgate de investimento', description: 'Resgate CDB' },
            { id: '2', date: '2026-10-01', amount: 15, type: 'expense', category: 'Taxas/Impostos', description: 'IRRF sobre resgate CDB' },
        ];
        expect(monthTotals(txs, '2026-10').balance).toBe(985);
    });

    it('CPF quebrado em qualquer ponto ainda é lido, e CPF ilegível impede casar só pelo nome', () => {
        expect(mentionsOwner('Maria Teste da Silva - ***.999.\n888-**', eu)).toBe(false);
        expect(mentionsOwner('Maria Teste da Silva - ***.123.\n456-**', eu)).toBe(true);
        expect(mentionsOwner('Maria Teste da Silva - ***.99', eu)).toBe(false);
    });

    it('PDF depois de CSV do mesmo banco marca possível duplicata em vez de importar de novo', () => {
        const csv: Transaction = { id: 'csv1', date: '2026-10-03', amount: 35.91, type: 'expense', category: 'Alimentação', description: 'Padaria',
            importHash: '0123456789abcdef', bank: 'Nubank', ...base };
        const pdf = parseStatementPdf([[
            { x: 382, y: 775, str: 'Maria Teste da Silva' }, { x: 57, y: 561, str: 'Movimentações' },
            { x: 58, y: 539, str: '03 OUT 2026' }, { x: 120, y: 539, str: 'Total de saídas' }, { x: 510, y: 539, str: '- 35,91' },
            { x: 120, y: 518, str: 'Compra no débito' }, { x: 262, y: 518, str: 'PADARIA CENTRAL' }, { x: 513, y: 518, str: '35,91' },
        ]], 'nubank.pdf');
        const [row] = prepareImport([pdf], c, [csv]);
        expect(row).toMatchObject({ status: 'possible-duplicate', duplicateOf: 'csv1', selected: false });
    });

    it('PDF com rótulo em pedaços e y fracionado gera um lançamento só, com os detalhes', () => {
        const itens: PdfItem[] = [
            { x: 57, y: 561, str: 'Movimentações' },
            { x: 58, y: 539, str: '03 OUT 2026' }, { x: 120, y: 539, str: 'Total de saídas' }, { x: 510, y: 539, str: '- 100,00' },
            { x: 120, y: 518, str: 'Transferência' }, { x: 186, y: 518, str: 'enviada pelo Pix' }, { x: 513, y: 518, str: '100,00' },
            { x: 262, y: 517.5, str: 'João Exemplo - •••.999.888-••' }, { x: 262, y: 498, str: '- BANCO Y' },
        ];
        const s = parseStatementPdf([itens], 'nubank.pdf');
        expect(s.rows).toEqual([{ date: '2026-10-03', amount: -100, description: 'Transferência enviada pelo Pix - João Exemplo - •••.999.888-•• - BANCO Y' }]);
    });

    it('avisa quando os lançamentos lidos não batem com o resumo do PDF', () => {
        const itens: PdfItem[] = [
            { x: 338, y: 630, str: 'Total de entradas' }, { x: 494, y: 630, str: '+0,00' },
            { x: 338, y: 610, str: 'Total de saídas' }, { x: 494, y: 610, str: '-200,00' },
            { x: 57, y: 561, str: 'Movimentações' },
            { x: 58, y: 539, str: '03 OUT 2026' }, { x: 120, y: 539, str: 'Total de saídas' },
            { x: 120, y: 518, str: 'Compra no débito' }, { x: 513, y: 518, str: '35,91' },
        ];
        expect(parseStatementPdf([itens], 'nubank.pdf').warnings[0]).toMatch(/não batem/);
    });

    it('duas contas recorrentes do mesmo estabelecimento: pagar uma deixa a outra pendente', () => {
        const vivo = (date: string): Transaction => ({ id: date + Math.random(), date, amount: 120, type: 'expense', category: 'Casa/Contas', description: 'Vivo' });
        const txs = [vivo('2026-08-05'), vivo('2026-08-20'), vivo('2026-09-05'), vivo('2026-09-20'), vivo('2026-10-05'),
            { id: 'r', date: '2026-10-01', amount: 1000, type: 'income', category: 'Salário', description: 'Freela' } as Transaction];
        const room = spendingRoom(txs, '2026-10', '2026-10-10');
        expect(room.pendingBills).toHaveLength(1);
        expect(room.available).toBe(760);
    });
});
