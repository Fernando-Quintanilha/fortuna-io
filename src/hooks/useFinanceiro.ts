import { useState, useEffect } from 'react';
import {
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    updateDoc,
    doc
} from 'firebase/firestore';
import {
    signInAnonymously,
    onAuthStateChanged,
    User
} from 'firebase/auth';
import { db, auth, transactionsCollection } from '../services/firebase';
import { Transaction, FinancialSummary } from '../types';

export function useFinanceiro() {
    const [user, setUser] = useState<User | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);

    const [summary, setSummary] = useState<FinancialSummary>({
        totalBalance: 0, totalIncome: 0, totalExpense: 0, totalInvested: 0
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;

        const q = query(
            transactionsCollection,
            where("uid", "==", user.uid),
            orderBy("date", "desc"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Transaction[];

            setTransactions(data);
            calculateSummary(data);
        });

        return () => unsubscribe();
    }, [user]);

    function calculateSummary(items: Transaction[]) {
        const acc = items.reduce(
            (acc, item) => {
                const value = Number(item.amount);
                if (item.type === 'income') {
                    acc.totalIncome += value;
                    acc.totalBalance += value;
                } else if (item.type === 'expense') {
                    acc.totalExpense += value;
                    acc.totalBalance -= value;
                } else if (item.type === 'investment') {
                    acc.totalInvested += value;
                    acc.totalBalance -= value;
                }
                return acc;
            },
            { totalBalance: 0, totalIncome: 0, totalExpense: 0, totalInvested: 0 }
        );
        setSummary(acc);
    }

    const addTransaction = async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
        if (!user) return;
        setLoading(true);
        try {
            await addDoc(transactionsCollection, {
                ...transaction,
                uid: user.uid,
                amount: Number(transaction.amount),
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Erro ao adicionar:", error);
        } finally {
            setLoading(false);
        }
    };

    // NOVA FUNÇÃO: EDITAR
    const editTransaction = async (id: string, transaction: Partial<Transaction>) => {
        setLoading(true);
        try {
            const docRef = doc(db, 'transactions', id);
            await updateDoc(docRef, {
                ...transaction,
                amount: Number(transaction.amount) // Garante numérico
            });
        } catch (error) {
            console.error("Erro ao editar:", error);
        } finally {
            setLoading(false);
        }
    };

    const deleteTransaction = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'transactions', id));
        } catch (error) {
            console.error("Erro ao deletar:", error);
        }
    };

    return {
        user,
        transactions,
        summary,
        addTransaction,
        editTransaction, // <--- Exportando a nova função
        deleteTransaction,
        loading
    };
}