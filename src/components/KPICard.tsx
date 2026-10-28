import { LucideIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { SecureValue } from './SecureValue';

interface KPICardProps {
    title: string;
    amount: number;
    icon: LucideIcon;
    variant?: 'default' | 'success' | 'danger' | 'accent';
    delta?: number | null;      // variação % vs. período anterior
    deltaGoodWhenUp?: boolean;  // gasto subir é ruim; receita subir é bom
    hint?: string;
    highlight?: boolean;
}

const ICON_TONE = {
    default: 'text-text-main',
    success: 'text-success',
    danger: 'text-danger',
    accent: 'text-accent',
};

export function KPICard({ title, amount, icon: Icon, variant = 'default', delta, deltaGoodWhenUp = true, hint, highlight }: KPICardProps) {
    const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
    const isGood = hasDelta && (delta! >= 0) === deltaGoodWhenUp;

    return (
        <div className={`glass glass-hover relative overflow-hidden p-5 ${highlight ? 'border-primary/30' : ''}`}>
            {highlight && <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/15 blur-3xl" />}
            <div className="mb-6 flex items-center justify-between">
                <p className="label-mono">{title}</p>
                <Icon size={16} className={ICON_TONE[variant]} />
            </div>

            <p className="font-mono text-2xl font-semibold tracking-tight text-text-main md:text-[28px]">
                <SecureValue value={amount} />
            </p>

            <div className="mt-3 flex min-h-5 items-center gap-2 text-xs">
                {hasDelta && (
                    <span className={`chip ${isGood ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>
                        {delta! >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(delta!).toFixed(0)}%
                    </span>
                )}
                {hint && <span className="text-text-dim">{hint}</span>}
            </div>
        </div>
    );
}
