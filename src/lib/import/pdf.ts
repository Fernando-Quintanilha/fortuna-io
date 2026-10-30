import type { RawTx, StatementKind } from './parse';
import { bankFromText } from './banks';
import { parseAmount, stripAccents } from './text';

// Texto posicionado de uma página (coordenadas do PDF: y cresce para cima)
export interface PdfItem { x: number; y: number; str: string }
export interface Holder { name: string; cpf?: string }

export async function readPdfItems(buffer: ArrayBuffer): Promise<PdfItem[][]> {
    // Carregado sob demanda: o pdf.js é pesado e só serve para quem sobe PDF
    const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    let pdf;
    try {
        pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    } catch (e) {
        if (e instanceof Error && e.name === 'PasswordException') throw new Error('O PDF está protegido por senha. Exporte o extrato sem senha.');
        throw new Error('Não foi possível abrir o PDF.');
    }
    const paginas: PdfItem[][] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const conteudo = await (await pdf.getPage(p)).getTextContent();
        paginas.push(conteudo.items
            .filter((it): it is typeof it & { str: string; transform: number[] } => 'str' in it && Boolean(it.str.trim()))
            .map(it => ({ x: it.transform[4], y: it.transform[5], str: it.str.trim() })));
    }
    return paginas;
}

const MESES: Record<string, string> = { jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06', jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12' };
const DATA_NU = /^(\d{2}) ([A-Z]{3}) (\d{4})$/;
const RODAPE = /^(extrato gerado|tem alguma duvida|metropolitanas|caso a solucao|disponiveis em|nao nos responsabilizamos)|^\d+ de \d+$/;
// Texto que só aparece depois da última movimentação
const FIM = /^(o saldo liquido|asseguramos)/;

type Parsed = { bank: string; account?: string; holder?: Holder; kind: StatementKind; rows: RawTx[]; warnings: string[] };

interface Linha { y: number; data: string; rotulo: string; detalhe: string; valor: string; texto: string }

// pdf.js pode quebrar uma frase em vários pedaços e variar o y em fração de ponto:
// junta os itens da mesma linha e separa por coluna antes de interpretar
function linhas(itens: PdfItem[]): Linha[] {
    const grupos: PdfItem[][] = [];
    for (const item of [...itens].sort((a, b) => b.y - a.y || a.x - b.x)) {
        const grupo = grupos.find(g => Math.abs(g[0].y - item.y) < 3);
        if (grupo) grupo.push(item); else grupos.push([item]);
    }
    const coluna = (g: PdfItem[], de: number, ate: number) => g.filter(i => i.x >= de && i.x < ate).sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
    return grupos.map(g => ({
        y: g[0].y, data: coluna(g, 0, 100), rotulo: coluna(g, 100, 250), detalhe: coluna(g, 250, 470), valor: coluna(g, 470, Infinity),
        texto: stripAccents(g.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').toLowerCase()),
    }));
}

// Extrato da conta Nubank: "DD MMM AAAA" na margem, blocos "Total de entradas/saídas"
// e, em cada lançamento, tipo à esquerda, detalhes no meio (quebrados em várias linhas) e valor à direita.
export function parseNubankAccountPdf(paginas: PdfItem[][]): Parsed {
    const rows: RawTx[] = [];
    let data: string | null = null;
    let sinal = 0;
    let atual: (RawTx & { detalhes: string[] }) | null = null;
    let ultimoY = 0;
    const fechar = () => {
        if (!atual) return;
        const { detalhes, ...tx } = atual;
        rows.push({ ...tx, description: [tx.description, detalhes.join(' ')].filter(Boolean).join(' - ') });
        atual = null;
    };

    let fim = false;
    paginas.forEach((itens, pagina) => {
        if (fim) return;
        // O corpo começa depois do cabeçalho ("VALORES EM R$") e, na 1ª página, depois de "Movimentações"
        const marco = itens.find(i => (pagina === 0 ? /^movimenta/i : /^valores em r\$/i).test(i.str));
        if (!marco) return;
        let continuacao = atual !== null; // primeiras linhas da página podem ser o resto do lançamento anterior
        for (const l of linhas(itens.filter(i => i.y < marco.y - 1))) {
            if (FIM.test(l.texto)) { fechar(); fim = true; break; }
            if (RODAPE.test(l.texto)) continue;
            const dataNu = l.data.match(DATA_NU);
            if (dataNu && MESES[dataNu[2].toLowerCase()]) {
                fechar();
                data = `${dataNu[3]}-${MESES[dataNu[2].toLowerCase()]}-${dataNu[1]}`;
            }
            if (l.rotulo) {
                fechar(); continuacao = false;
                const rotulo = stripAccents(l.rotulo.toLowerCase());
                if (/^total de entradas/.test(rotulo)) { sinal = 1; continue; }
                if (/^total de saidas/.test(rotulo)) { sinal = -1; continue; }
                const valor = /^[+-]?\s*[\d.]+,\d{2}$/.test(l.valor) ? parseAmount(l.valor.replace(/\s/g, '')) : null;
                if (!data || !sinal || valor === null) continue;
                atual = { date: data, amount: sinal * Math.abs(valor), description: l.rotulo, detalhes: l.detalhe ? [l.detalhe] : [] };
                ultimoY = l.y;
                continue;
            }
            if (l.detalhe && atual) {
                if (!continuacao && ultimoY - l.y > 25) { fechar(); continue; }
                (atual as RawTx & { detalhes: string[] }).detalhes.push(l.detalhe);
                ultimoY = l.y;
            }
        }
    });
    fechar();

    const primeira = [...(paginas[0] ?? [])].sort((a, b) => b.y - a.y);
    const cpf = primeira.find(i => /^[•*]{3}\.\d{3}\.\d{3}-[•*]{2}$/.test(i.str))?.str;
    const nome = primeira.find(i => i.x > 300 && /^\p{L}[\p{L} .'-]+$/u.test(i.str) && !/^(cpf|ag[eê]ncia|conta|valores)/i.test(i.str))?.str;
    const conta = primeira.find(i => i.x > 300 && /^\d{4,}-\d$/.test(i.str))?.str;
    const warnings = rows.length ? conferirResumo(primeira, rows) : ['Nenhuma movimentação encontrada no PDF.'];
    return {
        bank: 'Nubank', account: conta, kind: 'checking', rows,
        ...(nome ? { holder: { name: nome, ...(cpf ? { cpf: cpf.replace(/\D/g, '') } : {}) } } : {}),
        warnings,
    };
}

// O resumo da 1ª página traz o total de entradas e saídas do período: se não bater, algo foi lido errado
function conferirResumo(primeira: PdfItem[], rows: RawTx[]): string[] {
    const total = (rotulo: RegExp) => {
        const item = primeira.find(i => i.x > 300 && i.x < 470 && rotulo.test(stripAccents(i.str.toLowerCase())));
        const valor = item && primeira.find(i => i.x >= 470 && Math.abs(i.y - item.y) < 3);
        return valor ? parseAmount(valor.str.replace(/\s/g, '')) : null;
    };
    const centavos = (v: number) => Math.round(v * 100);
    const entradas = total(/^total de entradas/), saidas = total(/^total de saidas/);
    const lidoEntradas = rows.filter(r => r.amount > 0).reduce((s, r) => s + centavos(r.amount), 0);
    const lidoSaidas = rows.filter(r => r.amount < 0).reduce((s, r) => s + centavos(-r.amount), 0);
    if (entradas === null || saidas === null) return [];
    if (centavos(Math.abs(entradas)) === lidoEntradas && centavos(Math.abs(saidas)) === lidoSaidas) return [];
    return ['Os lançamentos lidos não batem com o resumo do extrato. Confira antes de importar ou use OFX/CSV.'];
}

export function parsePdf(paginas: PdfItem[][], arquivo: string): Parsed {
    const texto = paginas.flat().map(i => i.str).join(' ');
    if (!texto.trim()) throw new Error('O PDF não tem texto (parece uma imagem escaneada). Exporte o extrato em OFX ou CSV.');
    const banco = bankFromText(`${arquivo} ${texto}`);
    if (banco === 'Nubank' && /movimenta[cç][oõ]es/i.test(texto) && /total de (entradas|sa[ií]das)/i.test(texto)) {
        return parseNubankAccountPdf(paginas);
    }
    if (banco === 'Nubank') throw new Error('Por enquanto o Fortuna lê só o PDF do extrato da conta Nubank, não o da fatura do cartão. Exporte a fatura em CSV ou OFX.');
    throw new Error(`Esse PDF${banco ? ` (${banco})` : ''} ainda não é suportado: por enquanto só o extrato da conta Nubank. Exporte em OFX ou CSV.`);
}
