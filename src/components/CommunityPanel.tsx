import { useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Panel } from './ui/Panel';
import type { CommunityState } from '../hooks/useCommunity';

// Participar é opcional; receber o consenso vale para todo mundo
export function CommunityPanel({ community, size }: { community: CommunityState; size: number }) {
    const [saving, setSaving] = useState(false);

    async function toggle() {
        setSaving(true);
        try { await community.setOptIn(!community.optIn); } finally { setSaving(false); }
    }

    return (
        <Panel
            title="aprendizado coletivo"
            action={<span className="font-mono text-[11px] text-text-muted">{size} estabelecimentos da comunidade</span>}
        >
            <p className="mb-3 max-w-2xl text-sm text-text-muted">
                <Users size={14} className="mr-1.5 inline text-primary" />
                Quando várias pessoas categorizam o mesmo estabelecimento do mesmo jeito, todo mundo passa a receber essa
                sugestão. Um estabelecimento só entra com pelo menos 5 pessoas (contas com mais de 30 dias) e 70% de concordância;
                a sugestão aparece em “incertas” na importação para você confirmar, e qualquer escolha sua passa na frente.
            </p>
            <ul className="mb-4 max-w-2xl list-inside list-disc space-y-1 text-xs text-text-dim">
                <li>Se você participar, vai só o nome do estabelecimento e a categoria que <b className="text-text-muted">você</b> escolheu, de compras.
                    Nome que pode ser de pessoa fica no seu aparelho.</li>
                <li>Nunca vão valores, datas, saldos, números, Pix, TED, nada com CPF nem nomes de pessoas.</li>
                <li>Ninguém vê os votos de outra pessoa; o consenso é recalculado uma vez por dia. Sair apaga o que você enviou.</li>
            </ul>
            <div className="flex flex-wrap items-center gap-3">
                <button onClick={toggle} disabled={saving} className={community.optIn ? 'btn-ghost' : 'btn-primary'}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : community.optIn ? 'Parar de participar' : 'Participar'}
                </button>
                {community.optIn && (
                    <span className="font-mono text-xs text-text-muted">&gt; compartilhando {community.shared} estabelecimentos</span>
                )}
            </div>
            {community.error && <p className="mt-2 text-xs text-warning">{community.error}</p>}
        </Panel>
    );
}
