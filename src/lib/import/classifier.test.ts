import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../types';
import { Classifier } from './classifier';

const tx = (patch: Partial<Transaction> = {}): Transaction => ({ id: '1', date: '2026-10-01', description: 'PIX ENVIADO JOAO SILVA', amount: 100,
    type: 'transfer', category: 'Entre minhas contas', categorySource: 'user', ...patch });

describe('classificador', () => {
    it('usa regra-semente e aprende a correção pessoal antes das regras', () => {
        expect(Classifier.train([]).predict('IFOOD *RESTAURANTE X', -20, 'checking')).toMatchObject({ category: 'Alimentação', source: 'rule' });
        const c = Classifier.train([tx(), tx({ id: '2' })]);
        expect(c.predict('PIX ENVIADO JOAO SILVA', -100, 'checking')).toMatchObject({ type: 'transfer', category: 'Entre minhas contas', source: 'learned' });
        expect(c.learnedMerchants()[0].count).toBe(2); expect(c.trainingSize).toBe(2);
    });
    it('restringe direção na memória, regras e Bayes', () => {
        const c = Classifier.train([tx({ description: 'Loja secreta', type: 'expense', category: 'Compras' })]);
        for (const descricao of ['Loja secreta', 'Loja secreta filial', 'IFOOD', 'cdb', 'PIX ENVIADO']) {
            expect(c.predict(descricao, 20, 'checking').type).toBe('income');
        }
        expect(c.predict('salario', -20, 'checking').type).toBe('expense');
    });
    it('treina Bayes com pesos, ignora fallback e não usa tokens desconhecidos', () => {
        const c = Classifier.train([tx({ description: 'Clinica aurora consulta', type: 'expense', category: 'Saúde/Farmácia', categorySource: 'rule' }),
            tx({ description: 'ruido', categorySource: 'fallback' })]);
        expect(c.trainingSize).toBe(1); expect(c.learnedMerchants()).toHaveLength(0);
        expect(c.predict('Consulta aurora especial', -50, 'checking')).toMatchObject({ category: 'Saúde/Farmácia', source: 'learned' });
        expect(c.predict('desconhecido', -50, 'checking').source).toBe('fallback');
    });
    it('considera manuais antigos e mantém regras específicas antes de genéricas', () => {
        expect(Classifier.train([tx({ categorySource: undefined })]).learnedMerchants()).toHaveLength(1);
        const c = Classifier.train([]);
        expect(c.predict('mercado livre', -10, 'checking').category).toBe('Compras');
        expect(c.predict('amazon prime', -10, 'checking').category).toBe('Assinaturas');
        expect(c.predict('99', -10, 'checking').category).toBe('Uber/Delivery');
        expect(c.predict('pagamento recebido', 10, 'card').type).toBe('transfer');
        expect(c.predict('pagamento recebido', 10, 'checking').type).toBe('income');
        expect(c.predict('juros recebidos', 10, 'checking').category).toBe('Rendimentos');
    });
});
