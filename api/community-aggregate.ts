// Tarefa agendada da Vercel (vercel.json → crons), uma vez por dia: junta os votos do aprendizado coletivo
// e grava só o consenso em community/model, que o app lê direto do Firestore.
// Não há endpoint público: sem o CRON_SECRET a função recusa, então ninguém força leituras repetidas da coleção.
// Usa a conta de serviço em FIREBASE_SERVICE_ACCOUNT (JSON da chave).
// Autocontida de propósito: importar arquivos de src/ sem extensão quebra no ESM da Vercel.
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

export const MIN_USERS = 5;                 // estabelecimento só entra com votos de pelo menos 5 pessoas
export const MIN_AGREEMENT = 0.7;           // e 70% delas concordando
export const MIN_ACCOUNT_AGE_DAYS = 30;     // contas recém-criadas não votam (dificulta fabricar consenso)
export const MAX_VOTES = 500;
export const MAX_VOTES_CHARS = 32000;       // as regras do Firestore recusam documento maior
export const MAX_ENTRIES = 5000;            // o modelo cabe folgado no limite de 1 MiB de um documento
const PAGINA = 200;                         // documentos lidos por vez (até ~6 MB em memória)
const MAX_DOCS = 20000;                     // orçamento por execução (passou disso: não publica)
export const MAX_KEYS = 200000;             // estabelecimentos distintos contados em memória

// Iguais a COMMUNITY_CATEGORIES (mesma ordem: o voto grava o índice), COMMUNITY_KEY, FIRST_NAMES e BUSINESS_WORDS
// em src/lib/community.ts (o teste confere)
export const CATEGORIES = ['Alimentação', 'Mercado', 'Uber/Delivery', 'Combustível', 'Casa/Contas', 'Assinaturas', 'Saúde/Farmácia',
    'Academia', 'Lazer', 'Compras', 'Outfit', 'Educação', 'Viagem', 'Pets', 'Taxas/Impostos'];
const CHAVE = /^[a-z][a-z ]{2,58}[a-z]$/;
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
// Nome próprio ou título em qualquer palavra barra a chave. Identificação positiva: a chave só vale com uma palavra de estabelecimento.
// "wagner", "wagner silva" ou "dra maria souza" não entram; "cinemark shopping" e "padaria real" entram.
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

type Votes = Record<string, string>; // chave -> categoria
export interface CommunityEntry { key: string; type: 'expense'; category: string; users: number }

function chaveValida(key: string) {
    if (!CHAVE.test(key)) return false;
    const palavras = key.split(' ');
    if (palavras.length > 3 || palavras.some(p => FIRST_NAMES.has(p))) return false;
    return palavras.some(p => BUSINESS_WORDS.has(p));
}

// O que vem do Firestore não é confiável: lê o texto "chave=índice;" e descarta o que estiver fora do formato
export function sanitizeVotes(raw: unknown): Votes {
    if (typeof raw !== 'string' || raw.length > MAX_VOTES_CHARS) return {};
    const limpos: Votes = {};
    for (const item of raw.split(';').slice(0, MAX_VOTES)) {
        const m = /^([a-z ]+)=(\d{1,2})$/.exec(item);
        const categoria = m && CATEGORIES[Number(m[2])];
        if (m && categoria && chaveValida(m[1])) limpos[m[1]] = categoria;
    }
    return limpos;
}

type Contagem = Map<string, Map<string, number>>; // chave -> categoria -> pessoas

// Soma os votos de uma pessoa na contagem; chave nova além do teto é ignorada (memória limitada)
export function countVotes(contagem: Contagem, votos: Votes) {
    for (const [key, valor] of Object.entries(votos)) {
        let opcoes = contagem.get(key);
        if (!opcoes) {
            if (contagem.size >= MAX_KEYS) continue;
            opcoes = new Map<string, number>();
            contagem.set(key, opcoes);
        }
        opcoes.set(valor, (opcoes.get(valor) ?? 0) + 1);
    }
}

export function aggregateVotes(porPessoa: Votes[]): CommunityEntry[] {
    const contagem: Contagem = new Map();
    for (const votos of porPessoa) countVotes(contagem, votos);
    return consensus(contagem);
}

export function consensus(contagem: Contagem): CommunityEntry[] {
    const entries: CommunityEntry[] = [];
    for (const [key, opcoes] of contagem) {
        const total = [...opcoes.values()].reduce((s, n) => s + n, 0);
        const [categoria, votos] = [...opcoes].sort((a, b) => b[1] - a[1])[0];
        if (total < MIN_USERS || votos / total < MIN_AGREEMENT) continue;
        entries.push({ key, type: 'expense', category: categoria, users: total });
    }
    // Teto de tamanho: ficam os estabelecimentos com mais gente concordando
    return entries.sort((a, b) => b.users - a.users || a.key.localeCompare(b.key)).slice(0, MAX_ENTRIES);
}

// Conta não anônima, ativa e com idade mínima
export function trustedAccount(user: { disabled: boolean; providerData: unknown[]; metadata: { creationTime: string } }, agora = Date.now()) {
    const criada = Date.parse(user.metadata.creationTime);
    return !user.disabled && user.providerData.length > 0 && Number.isFinite(criada)
        && agora - criada >= MIN_ACCOUNT_AGE_DAYS * 86400000;
}

export async function GET(request: Request): Promise<Response> {
    const segredo = process.env.CRON_SECRET;
    if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) return new Response('não autorizado', { status: 401 });
    const credencial = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!credencial) return new Response('aprendizado coletivo não configurado', { status: 503 });
    try {
        if (!getApps().length) initializeApp({ credential: cert(JSON.parse(credencial)) });
        const db = getFirestore();
        // Lê em páginas, conta os votos de contas confiáveis e descarta a página
        const contagem: Contagem = new Map();
        let lidos = 0;
        let confiaveisTotal = 0;
        let ultimo: string | undefined;
        let completo = false;
        while (lidos < MAX_DOCS) {
            let consulta = db.collection('communityVotes').where('optIn', '==', true).orderBy('__name__').limit(PAGINA);
            if (ultimo) consulta = consulta.startAfter(ultimo);
            const { docs } = await consulta.get();
            if (!docs.length) { completo = true; break; }
            lidos += docs.length;
            ultimo = docs[docs.length - 1].id;
            const { users } = await getAuth().getUsers(docs.slice(0, 100).map(d => ({ uid: d.id })));
            const resto = docs.length > 100 ? (await getAuth().getUsers(docs.slice(100).map(d => ({ uid: d.id })))).users : [];
            const confiaveis = new Set([...users, ...resto].filter(u => trustedAccount(u)).map(u => u.uid));
            for (const d of docs) {
                if (!confiaveis.has(d.id)) continue;
                confiaveisTotal++;
                countVotes(contagem, sanitizeVotes(d.get('votes')));
            }
            if (docs.length < PAGINA) { completo = true; break; }
        }
        // Leitura cortada pelo orçamento: não publica um consenso parcial, mantém o modelo anterior
        if (!completo) {
            console.error('community-aggregate', `leitura incompleta: orçamento de ${MAX_DOCS} documentos atingido`);
            return new Response('leitura incompleta, modelo anterior mantido', { status: 507 });
        }
        const entries = consensus(contagem);
        await db.doc('community/model').set({ version: 1, generatedAt: FieldValue.serverTimestamp(), entries });
        return Response.json({ voters: lidos, trusted: confiaveisTotal, entries: entries.length });
    } catch (e) {
        console.error('community-aggregate', e instanceof Error ? e.message : e);
        return new Response('falha ao montar o modelo coletivo', { status: 500 });
    }
}
