import type { CategorySource, Transaction, TransactionType } from '../../types';
import { categoriesFor } from '../categories';
import type { StatementKind } from './parse';
import { merchantKey, merchantText, normalizeText, tokenize } from './text';
import { SEED } from './seed';
import type { CommunityEntry } from '../community';

export type SeedExample = { description: string; type: TransactionType; category: string };

export interface Prediction { type: TransactionType; category: string; source: CategorySource; confidence: number }
export interface LearnedMerchant { key: string; type: TransactionType; category: string; count: number }
type Rotulo = { type: TransactionType; category: string; peso: number; total: number; palavras: Map<string, number> };
type Regra = [TransactionType, string, RegExp, boolean?];

// Regras específicas precedem marcas e transferências genéricas.
const REGRAS: Regra[] = [
    ['transfer', 'Fatura do cartão', /\b(pagamento de fatura|pagto fatura|pag fatura)\b/],
    ['transfer', 'Fatura do cartão', /\bpagamento recebido\b/, true],
    // Imposto retido sobre aplicação vem antes de "cdb"/"resgate" para não virar investimento
    ['expense', 'Taxas/Impostos', /\b(irrf|imposto de renda)\b/],
    // Só para crédito (ver predict): "IRRF sobre resgate" é débito e cai em impostos
    ['transfer', 'Resgate de investimento', /\bresgate\b/],
    ['transfer', 'Entre minhas contas', /\b(mesma titularidade|entre contas)\b/],
    ['income', 'Rendimentos', /\b(rendimento\w*|juros recebidos|dividendo\w*)\b/],
    ['income', 'Salário', /\b(salario|folha|pagto salario|proventos)\b/],
    ['income', 'Reembolso', /\b(estorno|reembolso|cashback)\b/],
    ['investment', 'Reserva', /\b(caixinha|cofrinho|porquinho)\b/],
    ['investment', 'Renda Fixa', /\b(aplicacao|cdb|rdb|lci|lca|tesouro)\b/],
    ['investment', 'Ações', /\b(corretora|xp invest\w*|nuinvest|rico|clear)\b/],
    ['expense', 'Alimentação', /\b(ifood|rappi|ze delivery|padaria|restaurante|lanchonete|burger|mcdonalds|outback|starbucks)\b/],
    ['expense', 'Uber/Delivery', /\b(uber|noventanove|99\w*|cabify)\b/],
    ['expense', 'Combustível', /\b(posto|shell|ipiranga|petrobras|br mania)\b/],
    ['expense', 'Compras', /\b(mercado livre|mercadolivre)\b/],
    ['expense', 'Mercado', /\b(carrefour|assai|atacadao|pao de acucar|extra|mercado(?! pago)|supermercado|hortifruti)\b/],
    ['expense', 'Assinaturas', /\b(netflix|spotify|amazon prime|disney|hbo|max|youtube premium|apple com|google one|icloud|chatgpt|openai|deezer|globoplay)\b/],
    ['expense', 'Saúde/Farmácia', /\b(drogasil|droga raia|pague menos|drogaria|farmacia|unimed|hapvida|amil)\b/],
    ['expense', 'Academia', /\b(smartfit|smart fit|bluefit|gympass|wellhub|totalpass)\b/],
    ['expense', 'Casa/Contas', /\b(enel|light|cemig|copel|sabesp|cedae|comgas|vivo|claro|tim|oi|net|aluguel|condominio|iptu)\b/],
    ['expense', 'Compras', /\b(amazon|shopee|magalu|americanas|aliexpress|shein|kabum)\b/],
    ['expense', 'Outfit', /\b(renner|riachuelo|c a|zara|centauro|nike|adidas)\b/],
    ['expense', 'Educação', /\b(udemy|alura|coursera|escolas?|faculdades?|cursos?)\b/],
    ['expense', 'Viagem', /\b(latam|gol|azul|airbnb|booking|hotel|decolar|123milhas)\b/],
    ['expense', 'Pets', /\b(petz|cobasi|petshop|veterinari\w*)\b/],
    ['expense', 'Taxas/Impostos', /\b(iof|tarifa|anuidade|juros|multa|darf|pgdas|das simples|simples nacional|ipva|detran)\b/],
    ['income', 'Pix recebido', /\b(pix recebido|transferencia recebida)\b/],
    ['expense', 'Pix/Transferência', /\b(pix enviado|transferencia enviada)\b/],
];

function permitido(tipo: TransactionType, valor: number): boolean {
    return tipo === 'transfer' || (valor > 0 ? tipo === 'income' : tipo === 'expense' || tipo === 'investment');
}

// Naive Bayes multinomial por palavras, com suavização de Laplace
class Bayes {
    private rotulos = new Map<string, Rotulo>();
    private vocabulario = new Set<string>();

    aprender(type: TransactionType, category: string, descricao: string, peso: number) {
        const id = `${type}|${category}`;
        const rotulo = this.rotulos.get(id) ?? { type, category, peso: 0, total: 0, palavras: new Map<string, number>() };
        rotulo.peso += peso;
        for (const palavra of tokenize(descricao)) {
            this.vocabulario.add(palavra);
            rotulo.palavras.set(palavra, (rotulo.palavras.get(palavra) ?? 0) + peso);
            rotulo.total += peso;
        }
        this.rotulos.set(id, rotulo);
    }

    prever(description: string, signedAmount: number): { type: TransactionType; category: string; confidence: number } | null {
        const palavras = tokenize(description).filter(p => this.vocabulario.has(p));
        const candidatos = [...this.rotulos.values()].filter(r => permitido(r.type, signedAmount));
        if (!palavras.length || !candidatos.length) return null;
        const pesoTotal = candidatos.reduce((s, r) => s + r.peso, 0);
        const notas = candidatos.map(r => ({ r, nota: Math.log((r.peso + 1) / (pesoTotal + candidatos.length))
            + palavras.reduce((s, p) => s + Math.log(((r.palavras.get(p) ?? 0) + 1) / (r.total + this.vocabulario.size)), 0) }));
        notas.sort((a, b) => b.nota - a.nota);
        const confidence = 1 / notas.reduce((s, n) => s + Math.exp(n.nota - notas[0].nota), 0);
        return confidence >= 0.55 ? { type: notas[0].r.type, category: notas[0].r.category, confidence } : null;
    }
}

export class Classifier {
    readonly trainingSize: number;
    readonly seedSize: number;
    readonly communitySize: number;
    // Consenso de várias pessoas (aprendizado coletivo), por estabelecimento exato
    private coletivo = new Map<string, { type: TransactionType; category: string }>();
    private memoria = new Map<string, Map<string, LearnedMerchant>>();
    private pessoal = new Bayes();
    // Base de partida fora do Bayes: o vocabulário grande dela diluiria o que o usuário ensinou com poucos exemplos,
    // e palavras soltas ("conta", "caixa") dariam falso positivo. Vale só o nome do estabelecimento no início da descrição.
    private base: { prefixo: string; type: TransactionType; category: string }[] = [];

    private constructor(transactions: Transaction[], seed: SeedExample[], community: CommunityEntry[]) {
        for (const e of community) {
            if (categoriesFor(e.type).some(c => c.label === e.category)) this.coletivo.set(e.key, { type: e.type, category: e.category });
        }
        this.communitySize = this.coletivo.size;
        for (const e of seed) {
            const prefixo = merchantText(e.description);
            if (prefixo.length >= 4) this.base.push({ prefixo, type: e.type, category: e.category });
        }
        // Mais longo primeiro: "mercado livre" antes de "mercado"
        this.base.sort((a, b) => b.prefixo.length - a.prefixo.length);
        let tamanho = 0;
        for (const t of transactions) {
            if (!categoriesFor(t.type).some(c => c.label === t.category)) continue;
            const manual = t.categorySource === 'user' || (!t.categorySource && t.source !== 'import');
            // Sugestão da comunidade ('community') não confirmada fica de fora: não vira aprendizado pessoal
            const peso = manual ? 1 : t.categorySource === 'rule' || t.categorySource === 'learned' ? 0.25 : 0;
            if (!peso) continue;
            tamanho++;
            const descricao = t.rawDescription || t.description;
            const key = merchantKey(descricao);
            const id = `${t.type}|${t.category}`;
            if (manual && key) {
                const opcoes = this.memoria.get(key) ?? new Map<string, LearnedMerchant>();
                const voto = opcoes.get(id) ?? { key, type: t.type, category: t.category, count: 0 };
                voto.count++;
                opcoes.set(id, voto); this.memoria.set(key, opcoes);
            }
            this.pessoal.aprender(t.type, t.category, descricao, peso);
        }
        this.trainingSize = tamanho;
        this.seedSize = seed.length;
    }

    // seed: base de partida embutida no app; os testes passam [] para isolar o que vem só do usuário
    static train(transactions: Transaction[], seed: SeedExample[] = SEED, community: CommunityEntry[] = []): Classifier {
        return new Classifier(transactions, seed, community);
    }

    learnedMerchants(): LearnedMerchant[] {
        return [...this.memoria.values()].map(opcoes => ({ ...[...opcoes.values()].sort((a, b) => b.count - a.count)[0] }))
            .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
    }

    // Ordem: memória pessoal > regras fixas > modelo pessoal > consenso coletivo > estabelecimento da base > "Outros"
    predict(description: string, signedAmount: number, kind: StatementKind): Prediction {
        const opcoes = [...(this.memoria.get(merchantKey(description))?.values() ?? [])]
            .filter(v => permitido(v.type, signedAmount)).sort((a, b) => b.count - a.count);
        if (opcoes.length) {
            const vencedor = opcoes[0];
            return { type: vencedor.type, category: vencedor.category, source: 'learned', confidence: 0.9 + 0.09 * vencedor.count / opcoes.reduce((s, v) => s + v.count, 0) };
        }
        const texto = normalizeText(description.replace(/\b99\b/g, 'noventanove'));
        for (const [type, category, regra, cartao] of REGRAS) {
            if (category === 'Resgate de investimento' && signedAmount <= 0) continue;
            if (permitido(type, signedAmount) && (!cartao || kind === 'card') && regra.test(texto)) {
                return { type, category, source: 'rule', confidence: 0.8 };
            }
        }
        const pessoal = this.pessoal.prever(description, signedAmount);
        if (pessoal) return { ...pessoal, source: 'learned' };
        // Confiança abaixo de 0,6 de propósito: a sugestão da comunidade cai em "incertas" para a pessoa revisar
        const coletivo = this.coletivo.get(merchantKey(description));
        if (coletivo && permitido(coletivo.type, signedAmount)) return { ...coletivo, source: 'community', confidence: 0.55 };
        const estabelecimento = `${merchantText(description)} `;
        const conhecido = this.base.find(b => permitido(b.type, signedAmount) && estabelecimento.startsWith(`${b.prefixo} `));
        // Conta como regra: não é aprendizado do usuário
        if (conhecido) return { type: conhecido.type, category: conhecido.category, source: 'rule', confidence: 0.75 };
        return { type: signedAmount > 0 ? 'income' : 'expense', category: 'Outros', source: 'fallback', confidence: 0 };
    }
}
