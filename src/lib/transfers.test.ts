import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { cpfsIn, mentionsOwner, normalizeCpf } from './identity';
import { findTransferFixes, pairTransfers } from './transfers';
import { Classifier } from './import/classifier';
import { parseStatementText } from './import/parse';
import { prepareImport } from './import/prepare';

const eu = { name: 'Maria Teste da Silva', cpf: '123456' };

describe('identidade do titular', () => {
    it('lê CPF mascarado (inclusive quebrado entre linhas) e completo', () => {
        expect(cpfsIn('Maria - •••.123.456-•• - Banco X')).toEqual(['123456']);
        expect(cpfsIn('MARIA - •••. 123.456-•• - NEON')).toEqual(['123456']);
        expect(cpfsIn('***.123.456-** e 987.123.456-00')).toEqual(['123456', '123456']);
        expect(normalizeCpf('987.123.456-00')).toBe('123456');
        expect(normalizeCpf('•••.123.456-••')).toBe('123456');
        expect(normalizeCpf('12345')).toBeUndefined();
    });
    it('com CPF na descrição, só o CPF decide: homônimo com outro CPF não é o titular', () => {
        expect(mentionsOwner('Transferência enviada pelo Pix - MARIA T SILVA - •••.123.456-•• - ITAÚ', eu)).toBe(true);
        expect(mentionsOwner('Transferência Recebida - Maria Teste da Silva - •••.999.888-•• - NU', eu)).toBe(false);
        expect(mentionsOwner('Pix - Maria - •••.123.456-••', { name: 'Maria Teste da Silva' })).toBe(false);
    });
    it('sem CPF, exige o nome completo como palavras inteiras', () => {
        expect(mentionsOwner('PIX ENVIADO MARIA TESTE DA SILVA', eu)).toBe(true);
        expect(mentionsOwner('PIX ENVIADO MARIA TESTE DA SILVA JUNIOR', eu)).toBe(true);
        expect(mentionsOwner('PIX ENVIADO MARIA TESTE', eu)).toBe(false);
        expect(mentionsOwner('PIX ENVIADO MARIA SOUZA', { name: 'Maria Souza' })).toBe(false);
    });
});

describe('transferências entre bancos', () => {
    it('casa saída e entrada de mesmo valor em bancos diferentes em até 2 dias, só quando o par é único', () => {
        const pares = pairTransfers([
            { id: 'a', signed: -500, date: '2026-10-01', bank: 'Itaú' },
            { id: 'b', signed: 500, date: '2026-10-02', bank: 'Nubank' },
            { id: 'j', signed: -400, date: '2026-10-01', bank: 'Itaú' },
            { id: 'k', signed: 400, date: '2026-10-02', bank: 'Nubank' },
            { id: 'l', signed: 400, date: '2026-10-02', bank: 'Nubank' },
            { id: 'd', signed: -80, date: '2026-10-01', bank: 'Itaú' },
            { id: 'e', signed: 80, date: '2026-10-01', bank: 'Itaú' },
            { id: 'f', signed: -90, date: '2026-10-01', bank: 'Itaú' },
            { id: 'g', signed: 90, date: '2026-10-05', bank: 'Nubank' },
            { id: 'h', signed: -70, date: '2026-10-01', bank: 'Desconhecido' },
            { id: 'i', signed: 70, date: '2026-10-01', bank: 'Nubank' },
        ]);
        expect(Object.fromEntries(pares)).toEqual({ a: 'b', b: 'a' });
    });
    it('sugere correção para Pix ao próprio CPF, resgates antigos e pares, sem tocar no que o usuário escolheu', () => {
        const base = { source: 'import' as const, categorySource: 'rule' as const };
        const txs: Transaction[] = [
            { id: '1', date: '2026-10-07', amount: 2000, type: 'expense', category: 'Pix/Transferência', description: 'x', rawDescription: 'Transferência enviada pelo Pix - Maria Teste da Silva - •••.123.456-•• - Banco XP', bank: 'Nubank', ...base },
            { id: '2', date: '2026-10-15', amount: 2970, type: 'transfer', category: 'Entre minhas contas', description: 'Resgate RDB', bank: 'Nubank', ...base },
            { id: '3', date: '2026-10-07', amount: 300, type: 'expense', category: 'Pix/Transferência', description: 'Pix enviado', bank: 'Itaú', ...base },
            { id: '4', date: '2026-10-08', amount: 300, type: 'income', category: 'Pix recebido', description: 'Pix recebido', bank: 'Nubank', ...base },
            { id: '5', date: '2026-10-07', amount: 50, type: 'expense', category: 'Pix/Transferência', description: 'Pix - Maria Teste da Silva - •••.123.456-••', bank: 'Nubank', source: 'import', categorySource: 'user' },
            { id: '6', date: '2026-10-07', amount: 60, type: 'expense', category: 'Mercado', description: 'Mercado', bank: 'Itaú', ...base },
            { id: '7', date: '2026-10-07', amount: 60, type: 'income', category: 'Pix recebido', description: 'Pix recebido', bank: 'Nubank', ...base },
        ];
        const fixes = findTransferFixes(txs, eu);
        expect(Object.fromEntries(fixes.map(f => [f.transaction.id, f.category]))).toEqual({
            '1': 'Entre minhas contas', '2': 'Resgate de investimento', '3': 'Entre minhas contas', '4': 'Entre minhas contas',
        });
    });
    it('na importação, reconhece o titular pelo extrato e junta as pontas de dois bancos', () => {
        const ofx = (banco: string, valor: string, memo: string) => parseStatementText(
            `<OFX><BANKID>${banco}<ACCTID>1<BANKTRANLIST><STMTTRN><DTPOSTED>20261007<TRNAMT>${valor}<FITID>F${banco}<MEMO>${memo}</STMTTRN></BANKTRANLIST></OFX>`, `${banco}.ofx`);
        const rows = prepareImport([
            ofx('341', '-250.00', 'PIX ENVIADO JOAO'),
            ofx('260', '250.00', 'PIX RECEBIDO JOAO'),
            ofx('077', '-40.00', 'PIX ENVIADO MARIA TESTE DA SILVA'),
        ], Classifier.train([]), [], eu);
        expect(rows.map(r => [r.bank, r.type, r.category])).toEqual(expect.arrayContaining([
            ['Itaú', 'transfer', 'Entre minhas contas'],
            ['Nubank', 'transfer', 'Entre minhas contas'],
            ['Inter', 'transfer', 'Entre minhas contas'],
        ]));
    });
});
