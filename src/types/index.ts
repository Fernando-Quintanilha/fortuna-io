// src/types/index.ts

// 'transfer' = movimentação entre contas próprias (ex.: pagamento de fatura).
// Fica fora dos totais para não contar o mesmo gasto duas vezes.
export type TransactionType = 'income' | 'expense' | 'investment' | 'transfer';

// De onde veio a categoria: escolhida pelo usuário, regra fixa ou modelo aprendido
// community: sugestão do consenso coletivo, não confirmada pela pessoa (não entra no treino pessoal)
export type CategorySource = 'user' | 'rule' | 'learned' | 'community' | 'fallback';

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    type: TransactionType;
    category: string;
    date: string;
    createdAt?: any; // Usamos 'any' por enquanto para aceitar o Timestamp do Firebase

    // Campos de importação de extrato (ausentes em lançamentos manuais antigos)
    source?: 'manual' | 'import';
    bank?: string;
    rawDescription?: string;
    categorySource?: CategorySource;
    importHash?: string;
}

export interface FinancialSummary {
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    totalInvested: number;
}
