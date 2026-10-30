// Quem é o titular: serve para reconhecer Pix/TED entre as próprias contas em bancos diferentes.
// Guardamos só o nome e os 6 dígitos do meio do CPF (os que os bancos mostram mascarado).
import { stripAccents } from './import/text';

export interface Identity { name?: string; cpf?: string }

const chave = (uid: string) => `fortuna_identity_${uid}`;

export function loadIdentity(uid: string): Identity {
    try { return JSON.parse(localStorage.getItem(chave(uid)) ?? '{}') as Identity; } catch { return {}; }
}

export function saveIdentity(uid: string, identity: Identity) {
    localStorage.setItem(chave(uid), JSON.stringify(identity));
}

// "•••.123.456-••", "***.123.456-**" ou CPF completo -> "123456"
// Quebras de linha do PDF podem cair entre qualquer parte do CPF
const CPF = /(?:[•*xX]{3}|\d{3})\s*\.\s*(\d{3})\s*\.\s*(\d{3})\s*-\s*(?:[•*xX]{2}|\d{2})/g;
// Sinal de CPF mascarado que não deu para ler: aí o nome sozinho não basta
const CPF_ILEGIVEL = /[•*]{2,}/;
export function cpfsIn(text: string): string[] {
    return [...text.matchAll(CPF)].map(m => m[1] + m[2]);
}

export function normalizeCpf(input: string): string | undefined {
    const digitos = input.replace(/\D/g, '');
    if (digitos.length === 11) return digitos.slice(3, 9);
    return digitos.length === 6 ? digitos : undefined;
}

const nome = (s: string) => stripAccents(s.toLowerCase()).replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Com CPF na descrição, só ele decide (pai e filho podem ter o mesmo nome).
// CPF de outra pessoa na descrição: nunca é o titular.
// Sem CPF, exige o nome completo (mínimo de três palavras) como palavras inteiras.
export function mentionsOwner(text: string, identity: Identity): boolean {
    const cpfs = cpfsIn(text);
    if (cpfs.length) return Boolean(identity.cpf) && cpfs.includes(identity.cpf!);
    if (CPF_ILEGIVEL.test(text)) return false;
    const alvo = identity.name ? nome(identity.name) : '';
    if (alvo.split(' ').length < 3) return false;
    return ` ${nome(text)} `.includes(` ${alvo} `);
}

// Descrição que traz o CNPJ de uma empresa ou o CPF (legível ou não) de alguém que não é o titular
export function mentionsSomeoneElse(text: string, identity: Identity): boolean {
    if (/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(text)) return true;
    const cpfs = cpfsIn(text);
    if (cpfs.length) return !identity.cpf || !cpfs.includes(identity.cpf);
    return CPF_ILEGIVEL.test(text);
}
