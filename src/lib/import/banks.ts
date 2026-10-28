// Código COMPE -> nome do banco (os mais comuns em extratos OFX)
const BANK_CODES: Record<string, string> = {
    '001': 'Banco do Brasil',
    '033': 'Santander',
    '077': 'Inter',
    '104': 'Caixa',
    '208': 'BTG Pactual',
    '212': 'Banco Original',
    '237': 'Bradesco',
    '260': 'Nubank',
    '290': 'PagBank',
    '323': 'Mercado Pago',
    '336': 'C6 Bank',
    '341': 'Itaú',
    '380': 'PicPay',
    '403': 'Cora',
    '422': 'Safra',
    '655': 'Neon',
    '748': 'Sicredi',
    '756': 'Sicoob',
};

const NAME_HINTS: [RegExp, string][] = [
    [/nubank|nu pagamentos|nu ?bank/i, 'Nubank'],
    [/ita[uú]/i, 'Itaú'],
    [/bradesco/i, 'Bradesco'],
    [/santander/i, 'Santander'],
    [/\binter\b|banco inter/i, 'Inter'],
    [/c6/i, 'C6 Bank'],
    [/caixa|cef/i, 'Caixa'],
    [/banco do brasil|\bbb\b/i, 'Banco do Brasil'],
    [/btg/i, 'BTG Pactual'],
    [/mercado ?pago/i, 'Mercado Pago'],
    [/picpay/i, 'PicPay'],
    [/pagbank|pagseguro/i, 'PagBank'],
    [/xp\b|xp invest/i, 'XP'],
    [/sicoob/i, 'Sicoob'],
    [/sicredi/i, 'Sicredi'],
    [/neon/i, 'Neon'],
];

export function bankFromCode(code: string | undefined) {
    if (!code) return undefined;
    const clean = code.replace(/\D/g, '').slice(-3).padStart(3, '0');
    return BANK_CODES[clean];
}

export function bankFromText(text: string | undefined) {
    if (!text) return undefined;
    return NAME_HINTS.find(([re]) => re.test(text))?.[1];
}
