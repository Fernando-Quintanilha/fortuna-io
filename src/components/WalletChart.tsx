import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Transaction } from '../types';

interface WalletChartProps {
    transactions: Transaction[];
}

export function WalletChart({ transactions }: WalletChartProps) {

    const data = useMemo(() => {
        // Filtra apenas Investimentos
        const investments = transactions.filter(t => t.type === 'investment');

        // Agrupa por Categoria (Ações, FIIs, etc)
        const grouped = investments.reduce((acc, curr) => {
            const category = curr.category;
            const amount = Number(curr.amount);
            if (!acc[category]) acc[category] = 0;
            acc[category] += amount;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

    }, [transactions]);

    // Cores "Tech" para Investimentos (Roxo, Ciano, Emerald)
    const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#6366F1'];

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    if (data.length === 0) {
        return (
            <div className="bg-card border border-stroke rounded-2xl p-6 h-80 flex items-center justify-center text-text-muted">
                <p>Nenhum investimento cadastrado.</p>
            </div>
        );
    }

    return (
        <div className="bg-card border border-stroke rounded-2xl p-6 h-80 md:h-[400px] flex flex-col shadow-lg">
            <h3 className="text-xl font-bold text-text-main mb-4">Alocação de Ativos</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value) => formatCurrency(Number(value))}
                            contentStyle={{ backgroundColor: '#151A23', borderColor: '#2A3441', color: '#F8FAFC' }}
                            itemStyle={{ color: '#F8FAFC' }}
                        />
                        <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ color: '#94A3B8' }}>{value}</span>} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}