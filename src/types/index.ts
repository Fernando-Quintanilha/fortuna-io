// src/types/index.ts

export type TransactionType = 'income' | 'expense' | 'investment';

export interface Transaction {
    id: string;
    description: string;
    amount: number;
    type: TransactionType;
    category: string;
    date: string;
    createdAt?: any; // Usamos 'any' por enquanto para aceitar o Timestamp do Firebase
}

export interface FinancialSummary {
    totalBalance: number;
    totalIncome: number;
    totalExpense: number;
    totalInvested: number;
}