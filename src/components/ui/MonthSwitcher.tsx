import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel, shiftMonth } from '../../lib/format';

interface MonthSwitcherProps {
    month: string; // 'YYYY-MM'
    onChange: (month: string) => void;
}

export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
    return (
        <div className="flex items-center gap-1 rounded-xl border border-stroke bg-bg/60 p-1">
            <button
                title="Mês anterior"
                onClick={() => onChange(shiftMonth(month, -1))}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-text-main cursor-pointer"
            >
                <ChevronLeft size={18} />
            </button>
            <span className="min-w-[150px] text-center font-mono text-sm text-text-main first-letter:uppercase">
                {monthLabel(month)}
            </span>
            <button
                title="Mês seguinte"
                onClick={() => onChange(shiftMonth(month, 1))}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-text-main cursor-pointer"
            >
                <ChevronRight size={18} />
            </button>
        </div>
    );
}
