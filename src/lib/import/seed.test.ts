import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types';
import { categoriesFor } from '../categories';
import { Classifier } from './classifier';
import { SEED } from './seed';

describe('base de partida do modelo', () => {
    it('só usa categorias que existem para o tipo e não repete descrição', () => {
        for (const e of SEED) expect(categoriesFor(e.type).map(c => c.label), e.description).toContain(e.category);
        expect(new Set(SEED.map(e => e.description.toLowerCase())).size).toBe(SEED.length);
        expect(SEED.length).toBeGreaterThan(400);
    });

    it('conta nova já categoriza estabelecimentos que as regras fixas não conhecem', () => {
        const nova = Classifier.train([]);
        const semBase = Classifier.train([], []);
        const casos: [string, number, string][] = [
            ['BODYTECH UNIDADE CENTRO', -150, 'Academia'],
            ['CINEMARK SHOPPING', -60, 'Lazer'],
            ['LOCALIZA RENT A CAR', -400, 'Viagem'],
            ['SEM PARAR MENSALIDADE', -30, 'Uber/Delivery'],
            ['PANVEL FARMACIAS', -45, 'Saúde/Farmácia'],
            ['BINANCE', -500, 'Cripto'],
            ['ASSAI ATACADISTA LJ 21', -320, 'Mercado'],
            ['CREDITO SALARIO', 3000, 'Salário'],
        ];
        for (const [descricao, valor, categoria] of casos) {
            expect(nova.predict(descricao, valor, 'checking').category, descricao).toBe(categoria);
        }
        const acertosSemBase = casos.filter(([d, v, c]) => semBase.predict(d, v, 'checking').category === c).length;
        expect(acertosSemBase).toBeLessThan(casos.length / 2);
    });

    it('correção do usuário vence a base, e a base não conta como treino do usuário', () => {
        const minha: Transaction = { id: '1', date: '2026-10-01', amount: 60, type: 'expense', category: 'Outros', description: 'CINEMARK SHOPPING', categorySource: 'user' };
        const c = Classifier.train([minha]);
        expect(c.predict('CINEMARK SHOPPING', -60, 'checking')).toMatchObject({ category: 'Outros', source: 'learned' });
        expect(c.trainingSize).toBe(1);
        expect(c.seedSize).toBe(SEED.length);
        expect(c.learnedMerchants()).toHaveLength(1);
    });

    it('palpite da base respeita a direção do dinheiro e fica com confiança limitada', () => {
        const c = Classifier.train([]);
        expect(c.predict('BINANCE', 500, 'checking').type).toBe('income');
        const p = c.predict('CINEMARK SHOPPING', -60, 'checking');
        expect(p.source).toBe('rule');
        expect(p.confidence).toBeLessThanOrEqual(0.75);
    });
});
