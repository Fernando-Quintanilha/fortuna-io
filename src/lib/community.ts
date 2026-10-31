// Aprendizado coletivo, lado do navegador: quem participa envia só "estabelecimento -> categoria"
// das compras que categorizou à mão. A agregação roda uma vez por dia em api/community-aggregate.ts.
import type { Transaction } from '../types';
import { cpfsIn } from './identity';
import { merchantKey, normalizeText } from './import/text';

export const MAX_VOTES = 500;          // mesmos limites da função e das regras do Firestore
export const MAX_VOTES_CHARS = 32000;

export type Votes = Record<string, string>; // merchantKey -> categoria (sempre despesa)
export interface CommunityEntry { key: string; type: 'expense'; category: string; users: number }

// Categorias que a comunidade pode sugerir (só despesas; "Outros" e Pix ficam de fora).
// A função da Vercel tem a mesma lista, na mesma ordem (o voto grava o índice); o teste garante que não divergem.
export const COMMUNITY_CATEGORIES = ['Alimentação', 'Mercado', 'Uber/Delivery', 'Combustível', 'Casa/Contas', 'Assinaturas', 'Saúde/Farmácia',
    'Academia', 'Lazer', 'Compras', 'Outfit', 'Educação', 'Viagem', 'Pets', 'Taxas/Impostos'];
const PERMITIDAS = new Set(COMMUNITY_CATEGORIES);

// Pix, TED e transferências costumam trazer nome de pessoa: nunca saem do aparelho
const PESSOA = /\b(pix|ted|doc|tef|transferencia|transf|enviad[oa]|recebid[oa]|mesma titularidade|cpf)\b/;
// Só letras e espaços: nada de números (documentos, contas, telefones)
export const COMMUNITY_KEY = /^[a-z][a-z ]{2,58}[a-z]$/;
// Nome próprio comum ou título em qualquer palavra da chave: pode ser uma pessoa, não compartilha
export const FIRST_NAMES = new Set(['maria', 'jose', 'ana', 'joao', 'antonio', 'francisco', 'carlos', 'paulo', 'pedro', 'lucas', 'luiz', 'luis',
    'marcos', 'luciana', 'gabriel', 'rafael', 'daniel', 'marcelo', 'bruno', 'eduardo', 'felipe', 'raimundo', 'rodrigo', 'manoel', 'manuel',
    'mateus', 'matheus', 'andre', 'fernando', 'fabio', 'leonardo', 'gustavo', 'guilherme', 'leandro', 'tiago', 'thiago', 'anderson', 'ricardo',
    'marcio', 'jorge', 'sebastiao', 'alexandre', 'roberto', 'edson', 'diego', 'vitor', 'victor', 'sergio', 'claudio', 'juliana', 'adriana',
    'marcia', 'fernanda', 'patricia', 'aline', 'sandra', 'camila', 'amanda', 'bruna', 'jessica', 'leticia', 'julia', 'luana', 'mariana',
    'vanessa', 'beatriz', 'larissa', 'gabriela', 'renata', 'raquel', 'simone', 'priscila', 'carla', 'debora', 'rosa', 'francisca', 'antonia',
    'adriano', 'arthur', 'heitor', 'davi', 'enzo', 'miguel', 'bernardo', 'samuel', 'helena', 'alice', 'laura', 'valentina', 'sophia', 'sofia',
    'isabela', 'isabella', 'manuela', 'lorena', 'livia', 'giovanna', 'vinicius', 'igor', 'caio', 'murilo', 'otavio', 'henrique', 'wellington',
    'wesley', 'william', 'elaine', 'cristina', 'tatiane', 'eliane', 'viviane', 'silvia', 'monica', 'regina', 'lucia', 'vera', 'sonia', 'rita',
    'teresa', 'helio', 'gilberto', 'rogerio', 'renato', 'mauricio', 'geraldo', 'joaquim', 'benedito', 'divino', 'luciano', 'cleber',
    'kelly', 'karina', 'carolina', 'natalia', 'bianca', 'flavia', 'flavio', 'everton', 'emerson', 'jefferson', 'jonathan', 'kaique', 'joana',
    'dr', 'dra', 'sr', 'sra', 'prof', 'profa']);
// Identificação positiva: a chave só sai se tiver uma palavra de estabelecimento. Nome solto ("wagner"),
// "wagner silva" e "dra maria souza" ficam no aparelho; "cinemark shopping" e "padaria real" podem sair.
// Marcas de uma palavra só (ex.: "zaffari") também ficam: as grandes já estão na base embutida (seed.ts).
export const BUSINESS_WORDS = new Set(['loja', 'lojas', 'mercado', 'supermercado', 'supermercados', 'hipermercado', 'atacadao', 'atacado',
    'atacadista', 'mercearia', 'emporio', 'hortifruti', 'acougue', 'padaria', 'panificadora', 'confeitaria', 'doceria', 'pizzaria',
    'lanchonete', 'lanches', 'restaurante', 'churrascaria', 'hamburgueria', 'sorveteria', 'cafeteria', 'cafe', 'bar', 'bistro', 'pastelaria',
    'posto', 'postos', 'auto', 'combustiveis', 'farmacia', 'farmacias', 'drogaria', 'drogarias', 'academia', 'fitness', 'pet', 'petshop',
    'clinica', 'hospital', 'laboratorio', 'otica', 'cinema', 'cinemas', 'teatro', 'shopping', 'center', 'store', 'shop', 'market', 'magazine',
    'livraria', 'papelaria', 'floricultura', 'hotel', 'hoteis', 'pousada', 'estacionamento', 'lavanderia', 'barbearia', 'salao', 'ltda',
    'eireli', 'epp', 'comercio', 'servicos', 'distribuidora', 'industria', 'materiais', 'construcao', 'eletro', 'moveis', 'calcados', 'modas',
    'confeccoes', 'boutique', 'tabacaria', 'conveniencia', 'express', 'delivery', 'foods', 'food', 'burger', 'grill', 'sushi', 'cervejaria',
    'adega', 'distribuidor', 'veiculos', 'pneus', 'oficina', 'odonto', 'telecom', 'internet', 'energia', 'saneamento', 'seguros', 'escola',
    'colegio', 'faculdade', 'curso', 'cursos', 'idiomas', 'parque', 'turismo', 'viagens', 'aereas', 'airlines', 'cia', 'games', 'digital']);

export function isCommunityKey(key: string): boolean {
    if (!COMMUNITY_KEY.test(key)) return false;
    const palavras = key.split(' ');
    if (palavras.length > 3 || palavras.some(p => FIRST_NAMES.has(p))) return false;
    return palavras.some(p => BUSINESS_WORDS.has(p));
}

export function eligibleForCommunity(t: Transaction): boolean {
    if (t.categorySource !== 'user' || t.type !== 'expense' || !PERMITIDAS.has(t.category)) return false;
    const texto = t.rawDescription || t.description;
    // CPF (legível ou mascarado) indica pessoa física
    if (cpfsIn(texto).length || /[•*]{2,}/.test(texto) || PESSOA.test(normalizeText(texto))) return false;
    return isCommunityKey(merchantKey(texto));
}

// Último voto da pessoa por estabelecimento; se passar do limite, ficam os mais frequentes
export function buildVotes(txs: Transaction[]): Votes {
    const porChave = new Map<string, { valor: string; data: string; vezes: number }>();
    for (const t of txs.filter(eligibleForCommunity)) {
        const key = merchantKey(t.rawDescription || t.description);
        const atual = porChave.get(key);
        const valor = t.category;
        if (!atual) porChave.set(key, { valor, data: t.date, vezes: 1 });
        else {
            atual.vezes++;
            if (t.date >= atual.data) { atual.valor = valor; atual.data = t.date; }
        }
    }
    return Object.fromEntries([...porChave].sort((a, b) => b[1].vezes - a[1].vezes || a[0].localeCompare(b[0]))
        .slice(0, MAX_VOTES).map(([k, v]) => [k, v.valor]));
}

// Formato gravado no Firestore: "chave=índice;" — texto curto que a regra do Firestore valida inteiro (formato e tamanho)
export function encodeVotes(votes: Votes): string {
    let texto = '';
    for (const [key, categoria] of Object.entries(votes)) {
        const item = `${key}=${COMMUNITY_CATEGORIES.indexOf(categoria)};`;
        if (texto.length + item.length > MAX_VOTES_CHARS) break;
        texto += item;
    }
    return texto;
}

// Documento community/model validado de novo no navegador
export function parseCommunityModel(raw: unknown): CommunityEntry[] {
    const entries = (raw as { entries?: unknown })?.entries;
    if (!Array.isArray(entries)) return [];
    return entries.filter((e): e is CommunityEntry => Boolean(e) && typeof e.key === 'string' && isCommunityKey(e.key)
        && e.type === 'expense' && PERMITIDAS.has(e.category) && typeof e.users === 'number');
}
