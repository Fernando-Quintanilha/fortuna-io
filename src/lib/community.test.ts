import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { BUSINESS_WORDS, buildVotes, COMMUNITY_CATEGORIES, COMMUNITY_KEY, eligibleForCommunity, encodeVotes, FIRST_NAMES, MAX_VOTES_CHARS,
    parseCommunityModel } from './community';
import { aggregateVotes, BUSINESS_WORDS as MARCAS_SERVIDOR, CATEGORIES, countVotes, FIRST_NAMES as NOMES_SERVIDOR, MAX_ENTRIES, MAX_KEYS,
    MAX_VOTES_CHARS as LIMITE_SERVIDOR, sanitizeVotes, trustedAccount } from '../../api/community-aggregate';
import { EXPENSE_CATEGORIES } from './categories';
import { Classifier } from './import/classifier';
import { shortDescription } from './format';

const t = (description: string, patch: Partial<Transaction> = {}): Transaction => ({ id: description, date: '2026-10-01', amount: 50,
    type: 'expense', category: 'Lazer', description, categorySource: 'user', source: 'import', ...patch });
const letra = (n: number) => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(n) % 26];

describe('aprendizado coletivo · o que pode sair do aparelho', () => {
    it('só despesas escolhidas pela pessoa, sem Pix, CPF, números, nome próprio ou categoria genérica', () => {
        expect(eligibleForCommunity(t('CINEMARK SHOPPING'))).toBe(true);
        expect(eligibleForCommunity(t('CINEMARK SHOPPING', { categorySource: 'rule' }))).toBe(false);
        expect(eligibleForCommunity(t('BINANCE', { type: 'investment', category: 'Cripto' }))).toBe(false);
        expect(eligibleForCommunity(t('SALARIO EMPRESA', { type: 'income', category: 'Salário' }))).toBe(false);
        expect(eligibleForCommunity(t('PIX ENVIADO MARIA SOUZA'))).toBe(false);
        expect(eligibleForCommunity(t('MARIA SOUZA ***.123.456-**'))).toBe(false);
        expect(eligibleForCommunity(t('LOJA QUALQUER', { category: 'Outros' }))).toBe(false);
        // casos da revisão do Codex
        expect(eligibleForCommunity(t('MARIA SOUZA CPF12345678901'))).toBe(false);
        expect(eligibleForCommunity(t('COMPRA NO DEBITO - ANA EXEMPLO'))).toBe(false);
        expect(eligibleForCommunity(t('LOJA 12345 CENTRO'))).toBe(true); // número solto sai na normalização
        expect(eligibleForCommunity(t('LOJA ABC123 CENTRO'))).toBe(false);
        // 2ª revisão do Codex: nome de pessoa sem palavra de estabelecimento não sai, mesmo fora da lista de nomes
        expect(eligibleForCommunity(t('COMPRA NO DEBITO - WAGNER SILVA'))).toBe(false);
        expect(eligibleForCommunity(t('COMPRA NO DEBITO - DRA MARIA SOUZA'))).toBe(false);
        expect(eligibleForCommunity(t('MARIA LANCHES'))).toBe(false);
        expect(eligibleForCommunity(t('PADARIA REAL'))).toBe(true);
        // 3ª revisão: nome solto também fica; marca de uma palavra só sai com palavra de estabelecimento
        expect(eligibleForCommunity(t('COMPRA NO DEBITO - WAGNER'))).toBe(false);
        expect(eligibleForCommunity(t('COMPRA NO DEBITO - YASMIN'))).toBe(false);
        expect(eligibleForCommunity(t('ZAFFARI'))).toBe(false);
        expect(eligibleForCommunity(t('ZAFFARI SUPERMERCADO'))).toBe(true);
    });
    it('envia só chave e categoria, com o voto mais recente por estabelecimento', () => {
        const votos = buildVotes([
            t('CINEMARK SHOPPING', { date: '2026-09-01', category: 'Outfit' }),
            t('CINEMARK SHOPPING', { date: '2026-10-01', category: 'Lazer' }),
            t('PIX ENVIADO MARIA SOUZA'),
        ]);
        expect(votos).toEqual({ 'cinemark shopping': 'Lazer' });
        expect(encodeVotes(votos)).toBe('cinemark shopping=8;');
    });
    it('o texto gravado segue o formato e o limite das regras do Firestore', () => {
        const muitos = Object.fromEntries(Array.from({ length: 676 }, (_, i) => [`loja ${letra(i)}${letra(i / 26)}${'x'.repeat(50)}`, 'Lazer']));
        const texto = encodeVotes(muitos);
        expect(texto.length).toBeLessThanOrEqual(MAX_VOTES_CHARS);
        expect(texto.length).toBeGreaterThan(MAX_VOTES_CHARS - 70); // cortou no limite, sem item pela metade
        expect(texto.endsWith(';')).toBe(true);
        const regra = /^([a-z][a-z ]{2,58}[a-z]=([0-9]|1[0-4]);)*$/; // a mesma de firestore.rules.community
        expect(regra.test(encodeVotes({ 'cinemark shopping': 'Lazer', 'padaria real': 'Taxas/Impostos' }))).toBe(true);
    });
    it('navegador e servidor usam as mesmas categorias, nomes e formato de chave', () => {
        expect(COMMUNITY_CATEGORIES).toEqual(CATEGORIES);
        expect(BUSINESS_WORDS).toEqual(MARCAS_SERVIDOR);
        expect(MAX_VOTES_CHARS).toBe(LIMITE_SERVIDOR);
        expect(COMMUNITY_CATEGORIES.every(c => EXPENSE_CATEGORIES.some(e => e.label === c))).toBe(true);
        expect(FIRST_NAMES).toEqual(NOMES_SERVIDOR);
        expect(COMMUNITY_KEY.test('loja abc')).toBe(true); expect(COMMUNITY_KEY.test('loja 123')).toBe(false);
    });
});

describe('aprendizado coletivo · servidor', () => {
    it('descarta votos fora do formato, com número, nome próprio, categoria inexistente ou outro tipo', () => {
        expect(sanitizeVotes('cinemark shopping=8;X<script>=8;loja abc=8=1;maria souza=8;loja um=99;wagner silva=8;loja tres=Lazer;'))
            .toEqual({ 'cinemark shopping': 'Lazer' });
        expect(sanitizeVotes(null)).toEqual({}); expect(sanitizeVotes({ 'cinemark shopping': 8 })).toEqual({});
        expect(sanitizeVotes('loja abc=8;'.repeat(4000))).toEqual({}); // acima do limite: descarta tudo
    });
    it('só publica com 5+ pessoas e 70% de concordância', () => {
        const v = (valor: string) => ({ 'cinemark shopping': valor });
        const cinco = Array.from({ length: 5 }, () => v('Lazer'));
        expect(aggregateVotes(cinco)).toEqual([{ key: 'cinemark shopping', type: 'expense', category: 'Lazer', users: 5 }]);
        expect(aggregateVotes(cinco.slice(0, 4))).toEqual([]);
        expect(aggregateVotes([...cinco.slice(0, 3), v('Outfit'), v('Outfit')])).toEqual([]);
    });
    it('o modelo tem teto de tamanho e cabe num documento do Firestore', () => {
        // 2ª revisão do Codex: 40 grupos de 5 pessoas, 500 chaves cada = 20 mil entradas válidas
        const grupos = Array.from({ length: 40 }, (_, g) => Object.fromEntries(Array.from({ length: 500 },
            (_, i) => [`loja ${letra(g)}${letra(g + 7)}${letra(i)}${letra(i + 3)}${letra(Math.floor(i / 26))}${'x'.repeat(30)}`, 'Lazer'])));
        const entries = aggregateVotes(grupos.flatMap(g => Array.from({ length: 5 }, () => g)));
        expect(entries).toHaveLength(MAX_ENTRIES);
        expect(JSON.stringify(entries).length).toBeLessThan(900_000);
    });
    it('a contagem em memória tem teto de estabelecimentos distintos e segue contando os que já entraram', () => {
        const contagem = new Map<string, Map<string, number>>();
        for (let i = 0; i < MAX_KEYS; i++) contagem.set(`loja ${i}`, new Map([['Lazer', 1]]));
        countVotes(contagem, { 'loja nova': 'Lazer', 'loja 0': 'Lazer' });
        expect(contagem.size).toBe(MAX_KEYS);
        expect(contagem.get('loja 0')?.get('Lazer')).toBe(2);
    });
    it('conta anônima, desativada ou recém-criada não vota', () => {
        const agora = Date.parse('2026-10-30T00:00:00Z');
        const conta = (dias: number, patch = {}) => ({ disabled: false, providerData: [{}],
            metadata: { creationTime: new Date(agora - dias * 86400000).toUTCString() }, ...patch });
        expect(trustedAccount(conta(40), agora)).toBe(true);
        expect(trustedAccount(conta(5), agora)).toBe(false);
        expect(trustedAccount(conta(40, { providerData: [] }), agora)).toBe(false);
        expect(trustedAccount(conta(40, { disabled: true }), agora)).toBe(false);
    });
    it('o navegador revalida o consenso e a sugestão da comunidade vai para revisão, abaixo da escolha pessoal', () => {
        const entries = parseCommunityModel({ entries: [
            { key: 'loja da esquina', type: 'expense', category: 'Pets', users: 5 },
            { key: 'outra loja', type: 'expense', category: 'Categoria Inventada', users: 5 },
            { key: 'loja cripto', type: 'investment', category: 'Cripto', users: 5 },
            { key: 'maria souza', type: 'expense', category: 'Lazer', users: 5 },
        ] });
        expect(entries.map(e => e.key)).toEqual(['loja da esquina']);
        const c = Classifier.train([], [], entries);
        expect(c.predict('LOJA DA ESQUINA', -30, 'checking')).toMatchObject({ category: 'Pets', source: 'community', confidence: 0.55 });
        expect(c.predict('LOJA DA ESQUINA', 30, 'checking').category).not.toBe('Pets');
        const minha = Classifier.train([t('LOJA DA ESQUINA', { category: 'Mercado' })], [], entries);
        expect(minha.predict('LOJA DA ESQUINA', -30, 'checking').category).toBe('Mercado');
    });
    it('sugestão da comunidade importada sem confirmação não vira aprendizado pessoal', () => {
        // 2ª revisão do Codex: antes ela entrava no treino como 'rule' e subia para confiança 1
        const c = Classifier.train([t('CINEMARK SHOPPING', { category: 'Pets', categorySource: 'community' })], [], []);
        expect(c.trainingSize).toBe(0);
        expect(c.predict('CINEMARK SHOPPING', -30, 'checking').category).not.toBe('Pets');
    });
});

describe('descrição curta para telas pequenas', () => {
    it('corta no CPF/CNPJ e nos dados bancários', () => {
        expect(shortDescription('RECEITA FEDERAL - 00.394.460/0058-87 - BCO DO BRASIL S.A. (0001) Agência: 1607 Conta: 3')).toBe('RECEITA FEDERAL');
        expect(shortDescription('Ana Exemplo - •••.123.456-•• - NU PAGAMENTOS - IP (0260) Agência: 1')).toBe('Ana Exemplo');
        expect(shortDescription('Loja X - Produtos - 38.105.316/0001-10 - MERCADO PAGO')).toBe('Loja X - Produtos');
        expect(shortDescription('Compra no débito - PELICANO 18')).toBe('Compra no débito - PELICANO 18');
    });
});
