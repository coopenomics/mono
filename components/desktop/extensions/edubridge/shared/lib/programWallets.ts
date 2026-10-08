/**
 * Кошельки программы на экранах образования: значок и место в пути взноса.
 * Одни и те же значки у плиток остатков и в схеме движения средств.
 */
export const PROGRAM_WALLET_ICONS = {
  'w.edu.member': 'account_balance_wallet',
  'w.edu.escrow': 'lock_clock',
  'w.edu.fund': 'account_balance',
  'w.edu.teach': 'co_present',
} as const;

export type ProgramWalletId = keyof typeof PROGRAM_WALLET_ICONS;

/** Порядок кошельков по пути взноса: ученик → удержание → фонд → резерв. */
export const PROGRAM_WALLET_ORDER: ProgramWalletId[] = ['w.edu.member', 'w.edu.escrow', 'w.edu.fund', 'w.edu.teach'];
