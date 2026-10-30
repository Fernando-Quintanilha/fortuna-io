import { describe, expect, it } from 'vitest';
import type { PdfItem } from './pdf';
import { parsePdf } from './pdf';
import { parseStatementPdf } from './parse';
import { prepareImport } from './prepare';
import { Classifier } from './classifier';

// Layout do extrato da conta Nubank (dados fictícios): margem com data, tipo em x≈120, detalhes em x≈262, valor em x≈500
const cabecalho = (): PdfItem[] => [
    { x: 382, y: 775, str: 'Maria Teste da Silva' },
    { x: 364, y: 762, str: 'CPF' }, { x: 387, y: 762, str: '•••.123.456-••' },
    { x: 442, y: 762, str: 'Agência' }, { x: 484, y: 762, str: '0001' },
    { x: 509, y: 762, str: 'Conta' }, { x: 486, y: 750, str: '1234567-8' },
    { x: 57, y: 699, str: '01 DE OUTUBRO DE 2026' }, { x: 469, y: 699, str: 'VALORES EM R$' },
];
const rodape = (n: number): PdfItem[] => [
    { x: 57, y: 117, str: 'Tem alguma dúvida? Mande uma mensagem para nosso time de atendimento' },
    { x: 113, y: 61, str: 'Extrato gerado dia 29 de outubro de 2026 às 18:30' }, { x: 517, y: 61, str: `${n} de 3` },
];
const paginas: PdfItem[][] = [
    [...cabecalho(),
        { x: 338, y: 630, str: 'Total de entradas' }, { x: 494, y: 630, str: '+1.500,27' },
        { x: 57, y: 561, str: 'Movimentações' },
        { x: 58, y: 539, str: '03 OUT 2026' }, { x: 120, y: 539, str: 'Total de entradas' }, { x: 510, y: 539, str: '+ 0,27' },
        { x: 120, y: 518, str: 'Transferência recebida pelo Pix' }, { x: 262, y: 518, str: 'LOJA EXEMPLO LTDA - 11.222.333/0001-44 -' },
        { x: 262, y: 498, str: 'BANCO Y (0290) Agência: 1' }, { x: 517, y: 518, str: '0,27' },
        { x: 120, y: 444, str: 'Total de saídas' }, { x: 507, y: 444, str: '- 1.235,91' },
        { x: 120, y: 423, str: 'Compra no débito' }, { x: 262, y: 423, str: 'PADARIA CENTRAL' }, { x: 513, y: 423, str: '35,91' },
        { x: 120, y: 180, str: 'Transferência enviada pelo Pix' }, { x: 262, y: 180, str: 'Maria Teste da Silva - •••.123.456-••' },
        { x: 497, y: 180, str: '1.200,00' },
        { x: 262, y: 160, str: '- Banco XP S.A. (0348) Agência: 1 Conta:' },
        ...rodape(1)],
    [...cabecalho(),
        // continuação do último lançamento da página anterior
        { x: 262, y: 674, str: '99887-6' },
        { x: 58, y: 650, str: '15 OUT 2026' }, { x: 120, y: 650, str: 'Total de entradas' }, { x: 491, y: 650, str: '+ 1.500,00' },
        { x: 120, y: 629, str: 'Resgate RDB' }, { x: 499, y: 629, str: '1.500,00' },
        { x: 57, y: 157, str: 'O saldo líquido corresponde ao total de depósitos e rendimentos em conta.' },
        ...rodape(2)],
    [{ x: 57, y: 676, str: 'Asseguramos a autenticidade destas movimentações.' },
        { x: 338, y: 661, str: 'Nu Pagamentos S.A. - Instituição de' }, ...rodape(3)],
];

describe('PDF da conta Nubank', () => {
    it('lê lançamentos com sinal, detalhes em várias linhas e continuação entre páginas', () => {
        const s = parseStatementPdf(paginas, 'NU_extrato.pdf');
        expect(s).toMatchObject({ format: 'pdf', bank: 'Nubank', account: '1234567-8', kind: 'checking',
            holder: { name: 'Maria Teste da Silva', cpf: '123456' }, period: { from: '2026-10-03', to: '2026-10-15' }, warnings: [] });
        expect(s.rows).toEqual([
            { date: '2026-10-03', amount: 0.27, description: 'Transferência recebida pelo Pix - LOJA EXEMPLO LTDA - 11.222.333/0001-44 - BANCO Y (0290) Agência: 1' },
            { date: '2026-10-03', amount: -35.91, description: 'Compra no débito - PADARIA CENTRAL' },
            { date: '2026-10-03', amount: -1200, description: 'Transferência enviada pelo Pix - Maria Teste da Silva - •••.123.456-•• - Banco XP S.A. (0348) Agência: 1 Conta: 99887-6' },
            { date: '2026-10-15', amount: 1500, description: 'Resgate RDB' },
        ]);
    });
    it('classifica Pix para o próprio CPF e resgate como transferência', () => {
        const rows = prepareImport([parseStatementPdf(paginas, 'NU_extrato.pdf')], Classifier.train([]), []);
        const por = (d: string) => rows.find(r => r.rawDescription.startsWith(d))!;
        expect(por('Transferência enviada')).toMatchObject({ type: 'transfer', category: 'Entre minhas contas' });
        expect(por('Resgate')).toMatchObject({ type: 'transfer', category: 'Resgate de investimento' });
        expect(por('Compra no débito')).toMatchObject({ type: 'expense' });
    });
    it('recusa PDF sem texto ou de outro banco com mensagem clara', () => {
        expect(() => parsePdf([[]], 'scan.pdf')).toThrow(/imagem escaneada/);
        expect(() => parsePdf([[{ x: 1, y: 1, str: 'Banco Itaú extrato' }]], 'itau.pdf')).toThrow('(Itaú) ainda não é suportado');
        expect(() => parsePdf([[{ x: 1, y: 1, str: 'Nubank fatura do cartão' }]], 'nu.pdf')).toThrow(/fatura/);
    });
});
