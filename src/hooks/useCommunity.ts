import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Transaction } from '../types';
import { buildVotes, encodeVotes, parseCommunityModel } from '../lib/community';
import type { CommunityEntry } from '../lib/community';

export interface CommunityState {
    uid: string | null;              // conta a que este estado se refere
    entries: CommunityEntry[];       // consenso recebido (todo mundo recebe, participando ou não)
    optIn: boolean;                  // esta pessoa envia os próprios votos (fonte: o documento no Firestore)
    setOptIn(on: boolean): Promise<void>;
    shared: number;                  // quantos estabelecimentos esta pessoa está compartilhando
    error: string | null;
}

const votoDoc = (uid: string) => doc(db, 'communityVotes', uid);

function mensagem(e: unknown) {
    const codigo = (e as { code?: string })?.code;
    return codigo === 'permission-denied'
        ? 'O banco recusou: faltam as regras de communityVotes no Firestore ou a escolha mudou em outro aparelho (recarregue e tente de novo).'
        : 'Não foi possível sincronizar o aprendizado coletivo agora.';
}

interface Remoto { uid: string; optIn: boolean; votes: unknown; rev: number }

export function useCommunity(user: User | null, transactions: Transaction[], loading: boolean): CommunityState {
    const uid = user && !user.isAnonymous ? user.uid : null;
    const [entries, setEntries] = useState<CommunityEntry[]>([]);
    const [remoto, setRemoto] = useState<Remoto | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Escritas em fila (uma de cada vez) e "geração": sair da participação invalida o que ainda não foi enviado
    const fila = useRef<Promise<unknown>>(Promise.resolve());
    const geracao = useRef(0);
    // Último estado visto (inclui escritas locais ainda pendentes): de onde sai a versão (rev) da próxima escrita
    const atual = useRef<Remoto | null>(null);

    // Consentimento e votos vêm do próprio documento: vale para todas as abas e aparelhos ao mesmo tempo
    useEffect(() => {
        setRemoto(null); setError(null);
        atual.current = null;
        geracao.current++;
        // Fila nova por conta: escrita pendente da conta anterior não segura as desta
        fila.current = Promise.resolve();
        if (!uid) return;
        const guardar = (r: Remoto) => { atual.current = r; setRemoto(r); };
        return onSnapshot(votoDoc(uid),
            snap => {
                const d = snap.data();
                guardar({ uid, optIn: d?.optIn === true, votes: d?.votes, rev: typeof d?.rev === 'number' ? d.rev : 0 });
            },
            () => guardar({ uid, optIn: false, votes: '', rev: 0 }));
    }, [uid]);

    // Consenso gerado uma vez por dia pela tarefa da Vercel
    useEffect(() => {
        if (!uid) { setEntries([]); return; }
        let ativo = true;
        getDoc(doc(db, 'community', 'model'))
            .then(snap => { if (ativo) setEntries(parseCommunityModel(snap.data())); })
            .catch(() => { /* regras ainda não publicadas ou offline: segue com base + modelo pessoal */ });
        return () => { ativo = false; };
    }, [uid]);

    const optIn = Boolean(uid && remoto?.uid === uid && remoto.optIn);
    const votos = useMemo(() => buildVotes(transactions), [transactions]);
    const texto = useMemo(() => encodeVotes(votos), [votos]);

    function enfileirar(acao: () => Promise<unknown>) {
        const proxima = fila.current.then(acao, acao);
        fila.current = proxima.catch(() => undefined);
        return proxima;
    }

    // Envia os votos quando mudam (com atraso para juntar várias edições seguidas)
    useEffect(() => {
        if (!uid || !optIn || loading || texto === remoto?.votes) return;
        const minhaGeracao = geracao.current;
        const timer = setTimeout(() => {
            enfileirar(async () => {
                // Saiu da participação ou trocou de conta enquanto esperava: não envia
                if (geracao.current !== minhaGeracao || atual.current?.uid !== uid) return;
                // Mesma versão do consentimento: se ele mudou em outro aparelho, as regras recusam
                await updateDoc(votoDoc(uid), { votes: texto, rev: atual.current.rev, updatedAt: serverTimestamp() });
            }).then(() => setError(null), e => setError(mensagem(e)));
        }, 3000);
        return () => clearTimeout(timer);
    }, [uid, optIn, loading, texto, remoto?.votes]);

    async function setOptIn(on: boolean) {
        if (!uid) return;
        setError(null);
        const minhaGeracao = ++geracao.current; // cancela envios ainda não iniciados
        try {
            // Na fila: espera o envio em andamento terminar antes de gravar a nova escolha
            // Nova versão a partir da última vista: uma escolha antiga que chegue depois é recusada pelas regras
            await enfileirar(async () => {
                // Trocou de conta (ou houve outra escolha) enquanto esperava: não grava
                if (geracao.current !== minhaGeracao || (atual.current && atual.current.uid !== uid)) return;
                const rev = (atual.current?.rev ?? 0) + 1;
                return setDoc(votoDoc(uid), { optIn: on, votes: on ? texto : '', rev, updatedAt: serverTimestamp() });
            });
        } catch (e) {
            setError(mensagem(e));
        }
    }

    return { uid, entries, optIn, setOptIn, shared: optIn ? Object.keys(votos).length : 0, error };
}
