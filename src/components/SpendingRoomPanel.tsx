import { CalendarClock } from 'lucide-react';
import { Panel } from './ui/Panel';
import { SecureValue } from './SecureValue';
import { iconFor } from '../lib/categories';
import { shortDescription } from '../lib/format';
import type { SpendingRoom } from '../lib/insights';

// "Quanto ainda dá para gastar": a pergunta que a pessoa faz ao abrir o app
export function SpendingRoomPanel({ room }: { room: SpendingRoom }) {
    const negativo = room.available < 0;
    const contas = room.pendingBills.reduce((s, c) => s + c.amount, 0);
    const aReceber = room.pendingIncome.reduce((s, c) => s + c.amount, 0);
    const linhas: [string, number][] = [
        ['entradas', room.income],
        ['gastos', -room.expense],
        [room.invested >= 0 ? 'investido (aportes − resgates)' : 'resgatado dos investimentos', -room.invested],
        ...(contas ? [['contas recorrentes ainda por vir', -contas] as [string, number]] : []),
        ...(aReceber ? [['receitas recorrentes ainda por vir', aReceber] as [string, number]] : []),
    ];
    const compromissos = [...room.pendingBills.map(c => ({ ...c, entrada: false })), ...room.pendingIncome.map(c => ({ ...c, entrada: true }))];

    return (
        <Panel title="quanto ainda dá pra gastar" action={<span className="font-mono text-[11px] text-text-muted">{room.daysLeft} {room.daysLeft === 1 ? 'dia restante' : 'dias restantes'}</span>}>
            <div className="grid gap-6 lg:grid-cols-5">
                <div className="min-w-0 lg:col-span-2">
                    <p className={`font-mono text-3xl font-semibold tracking-tight md:text-4xl ${negativo ? 'text-danger' : 'text-primary'}`}>
                        <SecureValue value={room.available} />
                    </p>
                    <p className="mt-2 text-sm text-text-muted">
                        {negativo
                            ? 'Os compromissos do mês já passam do que entrou. Segure os gastos variáveis.'
                            : <>Cerca de <span className="font-mono text-text-main"><SecureValue value={room.perDay} /></span> por dia sem fechar o mês no vermelho.</>}
                    </p>
                    <ul className="mt-5 space-y-1.5 font-mono text-xs">
                        {linhas.map(([rotulo, valor]) => (
                            <li key={rotulo} className="flex justify-between gap-3 text-text-muted">
                                <span className="min-w-0">{rotulo}</span>
                                <span className={`shrink-0 ${valor >= 0 ? 'text-text-main' : 'text-text-muted'}`}>
                                    <SecureValue value={Math.abs(valor)} prefix={valor >= 0 ? '+ R$ ' : '− R$ '} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="min-w-0 lg:col-span-3">
                    <p className="label-mono mb-3 flex items-center gap-2"><CalendarClock size={12} className="text-primary" /> ainda vai cair neste mês</p>
                    {compromissos.length === 0 ? (
                        <p className="font-mono text-sm text-text-muted">&gt; nenhum recorrente pendente_</p>
                    ) : (
                        <ul className="divide-y divide-white/[0.05]">
                            {compromissos.slice(0, 6).map((c, i) => {
                                const Icon = iconFor(c.category);
                                return (
                                    <li key={i} className="flex items-center gap-3 py-2">
                                        <Icon size={14} className="shrink-0 text-text-muted" />
                                        <span className="min-w-0 flex-1 truncate text-sm" title={c.label}>{shortDescription(c.label)}</span>
                                        <span className={`shrink-0 font-mono text-sm ${c.entrada ? 'text-success' : 'text-text-main'}`}>
                                            <SecureValue value={c.amount} prefix={c.entrada ? '+ R$ ' : '- R$ '} />
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <p className="mt-3 text-[11px] text-text-dim">Baseado no que se repetiu nos meses anteriores e ainda não apareceu neste mês.</p>
                </div>
            </div>
        </Panel>
    );
}
