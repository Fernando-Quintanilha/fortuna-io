/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Paleta Fortuna Dark
                bg: '#0B0E14',      // Fundo quase preto
                card: '#151A23',    // Cinza azulado escuro (para cards e sidebar)
                stroke: '#2A3441',  // Bordas sutis
                primary: '#2563EB', // Azul Elétrico (Ações principais)
                accent: '#38BDF8',  // Ciano (Detalhes/Hover)
                'text-main': '#F8FAFC',  // Branco Gelo
                'text-muted': '#94A3B8', // Cinza Azulado (Texto secundário)
                success: '#10B981',
                danger: '#EF4444',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'], // Recomendo instalar a fonte Inter no index.html
            }
        },
    },
    plugins: [],
}