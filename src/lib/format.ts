const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export const formatCurrency = (value: number) => currency.format(value);
export const formatCompact = (value: number) => compact.format(value);

// 'YYYY-MM-DD' -> 'DD/MM/YYYY'
export function formatDate(dateString: string) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

// 'YYYY-MM' da data local
export function monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(key: string, delta: number) {
    const [y, m] = key.split('-').map(Number);
    return monthKey(new Date(y, m - 1 + delta, 1));
}

export function monthLabel(key: string, style: 'long' | 'short' = 'long') {
    const [y, m] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', style === 'long'
        ? { month: 'long', year: 'numeric' }
        : { month: 'short' }
    ).format(new Date(y, m - 1, 1)).replace('.', '');
}

export function todayISO() {
    const d = new Date();
    return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

// "TIM S A - 02.421.421/0001-11 - ITAÚ UNIBANCO..." -> "TIM S A": corta no CPF/CNPJ e nos dados bancários
export function shortDescription(description: string) {
    const curta = description.split(/\s+-\s+(?=[•*\d]{2,3}[.\d•*]*[./-])|\s+-\s+(?=.*\(\d{3,4}\)\s*Ag[eê]ncia)/)[0].trim();
    return curta || description;
}
