import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Transaction } from '../types';

interface ExpensesChartProps {
    transactions: Transaction[];
}

export function ExpensesChart({ transactions }: ExpensesChartProps) {

    const data = useMemo(() => {
        const expenses = transactions.filter(t => t.type === 'expense');

        const grouped = expenses.reduce((acc, curr) => {
            const category = curr.category;
            const amount = Number(curr.amount);

            if (!acc[category]) {
                acc[category] = 0;
            }
            acc[category] += amount;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(grouped)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

    }, [transactions]);

    const COLORS = ['#38BDF8', '#2563EB', '#818CF8', '#F472B6', '#34D399', '#FBBF24'];

    // CORREÇÃO 1: Nome da função corrigido (estava intformatCurrency)
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    if (data.length === 0) {
        // CORREÇÃO 2: Altura responsiva (h-80 no mobile, h-[300px] no desktop)
        return (
            <div className="bg-card border border-stroke rounded-2xl p-6 h-80 md:h-[300px] flex items-center justify-center text-text-muted">
                <p>Sem despesas para exibir gráfico.</p>
            </div>
        );
    }

    return (
        // CORREÇÃO 2: Altura responsiva (h-80 no mobile, h-[400px] no desktop)
        <div className="bg-card border border-stroke rounded-2xl p-6 h-80 md:h-[400px] flex flex-col shadow-lg">
            <h3 className="text-xl font-bold text-text-main mb-4">Despesas por Categoria</h3>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            // CORREÇÃO 3: Casting seguro para Number() para acalmar o TypeScript
                            formatter={(value) => formatCurrency(Number(value))}
                            contentStyle={{ backgroundColor: '#151A23', borderColor: '#2A3441', color: '#F8FAFC' }}
                            itemStyle={{ color: '#F8FAFC' }}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value) => <span style={{ color: '#94A3B8' }}>{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}