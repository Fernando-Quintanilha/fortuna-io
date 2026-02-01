import { LucideIcon } from 'lucide-react';

interface KPICardProps {
    title: string;
    amount: number;
    icon: LucideIcon;
    variant?: 'default' | 'success' | 'danger' | 'accent';
}

export function KPICard({ title, amount, icon: Icon, variant = 'default' }: KPICardProps) {

    // Função auxiliar para formatar dinheiro (BRL)
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    const variants = {
        default: 'text-text-main bg-primary/10 border-primary/20', // Azul (Saldo)
        success: 'text-success bg-success/10 border-success/20',    // Verde (Entradas)
        danger: 'text-danger bg-danger/10 border-danger/20',        // Vermelho (Saídas)
        accent: 'text-accent bg-accent/10 border-accent/20'         // Ciano (Investimentos)
    };

    return (
        <div className="bg-card border border-stroke rounded-2xl p-6 shadow-lg hover:border-text-muted/20 transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-text-muted mb-1">{title}</p>
                    <h3 className="text-2xl font-bold tracking-tight text-text-main">
                        {formatCurrency(amount)}
                    </h3>
                </div>

                <div className={`p-3 rounded-xl border ${variants[variant]}`}>
                    <Icon size={24} />
                </div>
            </div>
        </div>
    );
}