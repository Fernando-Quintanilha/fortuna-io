import type { RawTx, StatementKind } from './parse';
import { bankFromText } from './banks';
import { parseAmount, parseDate, stripAccents } from './text';

// Máquina de estados: preserva separadores e quebras de linha entre aspas.
function lerTabela(texto: string, separador: string): string[][] {
    const tabela: string[][] = [];
    let linha: string[] = [], campo = '', aspas = false;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (c === '"') {
            if (aspas && texto[i + 1] === '"') { campo += '"'; i++; }
            else aspas = !aspas;
        } else if (!aspas && c === separador) { linha.push(campo); campo = ''; }
        else if (!aspas && (c === '\r' || c === '\n')) {
            linha.push(campo); tabela.push(linha); linha = []; campo = '';
            if (c === '\r' && texto[i + 1] === '\n') i++;
        } else campo += c;
    }
    if (aspas) throw new Error('O CSV contém aspas sem fechamento. Exporte o arquivo novamente.');
    if (campo || linha.length) { linha.push(campo); tabela.push(linha); }
    return tabela;
}

const cabecalho = (s: string) => stripAccents(s.toLowerCase()).replace(/^\ufeff/, '').trim();

export function parseCsv(texto: string, arquivo: string): { bank: string; kind: StatementKind; rows: RawTx[]; warnings: string[] } {
    for (const separador of [';', ',', '\t']) {
        let tabela: string[][];
        try { tabela = lerTabela(texto, separador); } catch { continue; }
        for (let inicio = 0; inicio < Math.min(20, tabela.length); inicio++) {
            const h = tabela[inicio].map(cabecalho);
            const data = h.findIndex(s => /^(data|date|dt)(\b|_)/.test(s));
            const descricao = h.findIndex(s => !/^(data|date|dt)(\b|_)/.test(s) && /^(descricao|historico|title|titulo|lancamento|estabelecimento|memo|detalhe)(\b|_)/.test(s));
            const valor = h.findIndex(s => /^(valor|amount|value|quantia)(\b|_)/.test(s) && !/dolar|us\s*\$|usd/.test(s));
            const credito = h.findIndex(s => /^(credito|entrada)(\b|_)/.test(s));
            const debito = h.findIndex(s => /^(debito|saida)(\b|_)/.test(s));
            // Coluna que diz a direção (C/D, Crédito/Débito, Entrada/Saída) ao lado de um valor sem sinal
            const indicador = h.findIndex(s => /^(tipo|natureza|d\/?c|c\/?d|indicador|sinal)(\b|_|$)/.test(s));
            if (data < 0 || descricao < 0 || (valor < 0 && (credito < 0 || debito < 0))) continue;
            const rows: RawTx[] = [];
            let ignoradas = 0;
            let comIndicador = 0;
            for (const linha of tabela.slice(inicio + 1)) {
                if (!linha.some(s => s.trim())) continue;
                // Vírgula decimal sem aspas desloca as colunas: rejeita em vez de gravar valor truncado
                if (linha.length !== h.length && !(linha.length > h.length && linha.slice(h.length).every(s => !s.trim()))) {
                    ignoradas++;
                    continue;
                }
                const description = (linha[descricao] ?? '').trim();
                if (/^saldo\b/i.test(cabecalho(description))) continue;
                const date = parseDate(linha[data] ?? '');
                let amount = valor >= 0 ? parseAmount(linha[valor] ?? '') : null;
                if (valor < 0) {
                    const entrada = parseAmount(linha[credito] ?? '');
                    const saida = parseAmount(linha[debito] ?? '');
                    if (entrada !== null || saida !== null) amount = Math.abs(entrada ?? 0) - Math.abs(saida ?? 0);
                }
                if (!date || amount === null || Math.round(Math.abs(amount) * 100) === 0) { ignoradas++; continue; }
                if (indicador >= 0) {
                    const ind = cabecalho(linha[indicador] ?? '');
                    if (/^(d|deb|debito|saida|-)/.test(ind)) { amount = -Math.abs(amount); comIndicador++; }
                    else if (/^(c|cred|credito|entrada|\+)/.test(ind)) { amount = Math.abs(amount); comIndicador++; }
                }
                rows.push({ date, amount, description: description || 'Sem descrição' });
            }
            const faturaNu = h.includes('date') && h.includes('title') && h.includes('amount');
            const contaNu = h.includes('data') && h.includes('valor') && h.includes('identificador') && h.includes('descricao');
            const saldo = h.some(s => /\bsaldo\b/.test(s));
            const heuristica = !faturaNu && !contaNu && credito < 0 && debito < 0 && !saldo && comIndicador === 0
                && rows.length > 0 && rows.filter(r => r.amount > 0).length / rows.length > 0.7;
            const kind: StatementKind = faturaNu || heuristica ? 'card' : 'checking';
            if (kind === 'card') rows.forEach(r => { r.amount = -r.amount; });
            const warnings = ignoradas ? [`${ignoradas} linha(s) ignorada(s) por data ou valor inválido ou zerado.`] : [];
            if (heuristica) warnings.push('Arquivo interpretado como fatura de cartão pela predominância de valores positivos. Confira o tipo do extrato.');
            return { bank: bankFromText(`${arquivo} ${tabela.slice(0, inicio + 1).flat().join(' ')}`) || 'Desconhecido', kind, rows, warnings };
        }
    }
    throw new Error('Não foi possível reconhecer o CSV. Verifique as colunas de data, descrição e valor nas primeiras 20 linhas.');
}
