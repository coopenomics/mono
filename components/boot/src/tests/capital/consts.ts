export const sourceProgramId = 3
export const capitalProgramId = 4
export const walletProgramId = 1

// draft_id для программных соглашений — соответствует мапе `program_map` из
// `lib/core/programs.hpp` (wallet→1, source/generator→0, capital/blagorost→1000).
// Используются при `wallet::signagree` (program_id > 0 после Эпика 2 / компонента 48
// ушло из soviet::sndagreement и подписывается через wallet).
export const walletDraftId = 1
export const sourceDraftId = 0
export const capitalDraftId = 1000

export const ratePerHour = '1000.0000 RUB'
export const sourceProgramName = 'generator'
export const capitalProgramName = 'blagorost'
// ledger2::accounts.id хранит счёт со смещением *1000 (80 → 80000).
export const circulationAccountId = 80_000
