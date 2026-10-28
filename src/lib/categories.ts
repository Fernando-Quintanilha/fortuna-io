import {
    Utensils, Car, ShoppingCart, HeartPulse, Shirt, Dumbbell, Gamepad2, Home, GraduationCap, MoreHorizontal,
    Bitcoin, Building2, TrendingUp, Landmark, Banknote, PiggyBank, Repeat, Plane, PawPrint, Receipt,
    Briefcase, ArrowDownLeft, RotateCcw, ShoppingBasket, Fuel, ArrowLeftRight, LucideIcon,
} from 'lucide-react';
import { TransactionType } from '../types';

export interface Category {
    label: string; // valor salvo no Firestore (mantido igual aos lançamentos antigos)
    icon: LucideIcon;
}

export const EXPENSE_CATEGORIES: Category[] = [
    { label: 'Alimentação', icon: Utensils },
    { label: 'Mercado', icon: ShoppingBasket },
    { label: 'Uber/Delivery', icon: Car },
    { label: 'Combustível', icon: Fuel },
    { label: 'Casa/Contas', icon: Home },
    { label: 'Assinaturas', icon: Repeat },
    { label: 'Saúde/Farmácia', icon: HeartPulse },
    { label: 'Academia', icon: Dumbbell },
    { label: 'Lazer', icon: Gamepad2 },
    { label: 'Compras', icon: ShoppingCart },
    { label: 'Outfit', icon: Shirt },
    { label: 'Educação', icon: GraduationCap },
    { label: 'Viagem', icon: Plane },
    { label: 'Pets', icon: PawPrint },
    { label: 'Taxas/Impostos', icon: Receipt },
    { label: 'Pix/Transferência', icon: ArrowLeftRight },
    { label: 'Outros', icon: MoreHorizontal },
];

export const INCOME_CATEGORIES: Category[] = [
    { label: 'Salário', icon: Briefcase },
    { label: 'Pix recebido', icon: ArrowDownLeft },
    { label: 'Reembolso', icon: RotateCcw },
    { label: 'Rendimentos', icon: TrendingUp },
    { label: 'Outros', icon: MoreHorizontal },
];

export const INVESTMENT_CATEGORIES: Category[] = [
    { label: 'Ações', icon: TrendingUp },
    { label: 'FIIs', icon: Building2 },
    { label: 'Cripto', icon: Bitcoin },
    { label: 'Renda Fixa', icon: Landmark },
    { label: 'Reserva', icon: PiggyBank },
    { label: 'Exterior', icon: Banknote },
    { label: 'Outros', icon: MoreHorizontal },
];

export const TRANSFER_CATEGORIES: Category[] = [
    { label: 'Fatura do cartão', icon: Receipt },
    { label: 'Entre minhas contas', icon: ArrowLeftRight },
];

export function categoriesFor(type: TransactionType): Category[] {
    switch (type) {
        case 'income': return INCOME_CATEGORIES;
        case 'investment': return INVESTMENT_CATEGORIES;
        case 'transfer': return TRANSFER_CATEGORIES;
        default: return EXPENSE_CATEGORIES;
    }
}

export function defaultCategory(type: TransactionType): string {
    return categoriesFor(type)[0].label;
}

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...INVESTMENT_CATEGORIES, ...TRANSFER_CATEGORIES];

export function iconFor(label: string): LucideIcon {
    return ALL.find(c => c.label === label)?.icon ?? MoreHorizontal;
}

export const TYPE_LABEL: Record<TransactionType, string> = {
    income: 'Receita',
    expense: 'Despesa',
    investment: 'Investimento',
    transfer: 'Transferência',
};
