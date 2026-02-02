import { usePrivacy } from '../contexts/PrivacyContext';

interface SecureValueProps {
    value: number;
    prefix?: string; // ex: "R$ "
}

export function SecureValue({ value, prefix = "R$ " }: SecureValueProps) {
    const { isVisible } = usePrivacy();

    if (!isVisible) {
        return <span className="tracking-widest">••••••</span>; // O visual "censurado"
    }

    // Formata o dinheiro bonitinho
    const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);

    return <span>{prefix}{formatted}</span>;
}