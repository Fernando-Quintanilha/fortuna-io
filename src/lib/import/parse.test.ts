import { describe, expect, it } from 'vitest';
import { invertStatement, parseStatement, parseStatementText } from './parse';
import { parseAmount, parseDate } from './text';

describe('valores e datas', () => {
    it.each([['1.234,56', 1234.56], ['1,234.56', 1234.56], ['R$ 12,00', 12], ['(12,00)', -12],
        ['12,00 D', -12], ['-12,00 D', -12], ['12,00 C', 12], ['12.50-', -12.5], ['+12.00', 12], ['0', 0],
        ['', null], ['abc', null], ['1,2,3', null], ['1.2.3,45', null], ['1,2,3.45', null], ['Infinity', null]] as const)('interpreta %s', (entrada: string, esperado: number | null) => {
        expect(parseAmount(entrada)).toBe(esperado);
    });
    it.each([['29/02/2024', '2024-02-29'], ['1/2/24', '2024-02-01'], ['20261028', '2026-10-28'],
        ['2026-10-28', '2026-10-28'], ['2026-10-28T12:00:00', '2026-10-28'], ['31/02/2026', null],
        ['29/02/2025', null], ['2026-13-01', null], ['00/10/2026', null], ['lixo', null]] as const)('valida %s', (entrada: string, esperado: string | null) => {
        expect(parseDate(entrada)).toBe(esperado);
    });
});

describe('OFX', () => {
    it('lê SGML Itaú em Latin-1, vírgula e entidades sem fechar campos', async () => {
        const texto = 'OFXHEADER:100\r\n<OFX><BANKID>341\r\n<BANKTRANLIST><STMTTRN>\r\n<DTPOSTED>20261002120000[-3:BRT]\r\n<TRNAMT>-12,50\r\n<FITID>abc\r\n<NAME>CAFÉ &amp; PÃO\r\n<MEMO>Compra\r\n</STMTTRN></BANKTRANLIST></OFX>';
        const bytes = Uint8Array.from(texto, c => c.charCodeAt(0));
        const s = await parseStatement(new File([bytes], 'itau.ofx'));
        expect(s).toMatchObject({ bank: 'Itaú', kind: 'checking', format: 'ofx', period: { from: '2026-10-02', to: '2026-10-02' } });
        expect(s.rows).toEqual([{ date: '2026-10-02', amount: -12.5, fitId: 'abc', description: 'CAFÉ & PÃO - Compra' }]);
    });
    it('lê XML Nubank conta e não repete NAME/MEMO iguais', () => {
        const s = parseStatementText('<OFX><ORG>NU PAGAMENTOS</ORG><STMTTRN><DTPOSTED>20261001</DTPOSTED><TRNAMT>100.00</TRNAMT><NAME>Pix</NAME><MEMO>Pix</MEMO><FITID>n1</FITID></STMTTRN></OFX>', 'extrato.ofx');
        expect(s.bank).toBe('Nubank'); expect(s.rows[0]).toMatchObject({ amount: 100, description: 'Pix' });
    });
    it('preserva sinal de compras no OFX de cartão e ignora inválidas', () => {
        const s = parseStatementText('<OFX><CCSTMTRS><STMTTRN><DTPOSTED>20261001<TRNAMT>-15<NAME>Loja</STMTTRN><STMTTRN><DTPOSTED>20260231<TRNAMT>15</STMTTRN></CCSTMTRS></OFX>', 'nubank.ofx');
        expect(s.kind).toBe('card'); expect(s.rows[0].amount).toBe(-15); expect(s.warnings).toHaveLength(1);
        const invertido = invertStatement(s);
        expect(invertido.kind).toBe('checking'); expect(invertido.rows[0].amount).toBe(15); expect(s.rows[0].amount).toBe(-15);
    });
});

describe('CSV', () => {
    it('ignora valores zerados e menores que um centavo com aviso', () => {
        const s = parseStatementText('Data;Descrição;Valor;Saldo\n01/10/2026;Zero;0;100\n01/10/2026;Fração;0,001;100', 'conta.csv');
        expect(s.rows).toEqual([]); expect(s.period).toBeNull(); expect(s.warnings[0]).toContain('zerado');
    });
    it('reconhece conta Nubank mesmo com todas as entradas positivas', () => {
        const s = parseStatementText('Data,Valor,Identificador,Descrição\n01/10/2026,100,a,Pix recebido', 'nubank.csv');
        expect(s.kind).toBe('checking'); expect(s.rows[0].amount).toBe(100);
    });
    it('inverte fatura Nubank, inclusive estorno', () => {
        const s = parseStatementText('date,title,amount\n2026-10-01,Loja,50.00\n2026-10-02,Estorno,-10.00', 'nubank.csv');
        expect(s.kind).toBe('card'); expect(s.rows.map(r => r.amount)).toEqual([-50, 10]);
    });
    it('lê preâmbulo, ponto e vírgula, aspas escapadas, saldo e Data Lançamento', () => {
        const s = parseStatementText('Banco Itaú\nData Lançamento;Descrição;Valor;Saldo\n01/10/2026;"Loja; ""Centro""";"-1.234,56";0\n01/10/2026;SALDO ANTERIOR;100;100\n31/02/2026;Erro;10;0', 'conta.csv');
        expect(s.rows).toEqual([{ date: '2026-10-01', description: 'Loja; "Centro"', amount: -1234.56 }]);
        expect(s.bank).toBe('Itaú'); expect(s.warnings).toHaveLength(1);
    });
    it('lê crédito e débito separados, sem inferir cartão', () => {
        const s = parseStatementText('Data;Histórico;Crédito;Débito\n01/10/2026;Entrada;100;\n02/10/2026;Compra;;20\n03/10/2026;Compra;;-30', 'conta.csv');
        expect(s.rows.map(r => r.amount)).toEqual([100, -20, -30]); expect(s.kind).toBe('checking');
    });
    it('detecta tab, ignora dólar e aplica heurística somente sem saldo', () => {
        const s = parseStatementText('dt\tmemo\tValor US$\tValor\n01/10/2026\tCompra\t10\t50', 'banco.csv');
        expect(s.rows[0].amount).toBe(-50); expect(s.kind).toBe('card'); expect(s.warnings).toHaveLength(1);
        expect(parseStatementText('Data;Descrição;Valor;Saldo\n01/10/2026;Entrada;50;50', 'banco.csv').kind).toBe('checking');
    });
    it('preserva quebra de linha entre aspas e rejeita arquivo não reconhecido', () => {
        expect(parseStatementText('date,title,amount\n2026-10-01,"Loja\nCentro",20', 'fatura.csv').rows[0].description).toBe('Loja\nCentro');
        expect(() => parseStatementText('arquivo sem colunas', 'arquivo.txt')).toThrow(/Não foi possível reconhecer/);
        expect(() => parseStatementText('date,title,amount\n2026-10-01,"Loja,20', 'arquivo.csv')).toThrow();
    });
});
