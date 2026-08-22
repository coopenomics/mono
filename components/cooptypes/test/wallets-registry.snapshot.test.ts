import { describe, expect, it } from 'vitest'
import {
  EXIT_REFUND_WALLET_NAMES,
  LEDGER2_EXIT_REFUND_WALLETS,
  LEDGER2_USER_SHARED_PROGRAM_MAPPING,
  LEDGER2_WALLET_REGISTRY,
  programIdForWallet,
  walletNamesForProgram,
} from '../src/ledger2/wallets'

/**
 * Snapshot-тест для генерации `wallets.generated.ts` из C++ (`wallets.hpp`).
 * Любое изменение реестра в hpp требует осознанного обновления снепшота:
 *   pnpm --filter cooptypes test -- -u
 *
 * Если этот тест упал, но в hpp ничего не менялось — значит сломался парсер
 * `scripts/gen-from-cpp.ts` или формат hpp-файла поехал.
 */
describe('ledger2 wallets registry (generated from C++)', () => {
  it('LEDGER2_WALLET_REGISTRY snapshot', () => {
    expect(LEDGER2_WALLET_REGISTRY).toMatchSnapshot()
  })

  it('LEDGER2_USER_SHARED_PROGRAM_MAPPING snapshot', () => {
    expect(LEDGER2_USER_SHARED_PROGRAM_MAPPING).toMatchSnapshot()
  })

  it('helpers: programIdForWallet и walletNamesForProgram согласованы', () => {
    // Каждый USER_SHARED-кошелёк с program_id > 0 — ровно у того program_id.
    for (const m of LEDGER2_USER_SHARED_PROGRAM_MAPPING) {
      if (m.required_program_id <= 0) continue
      expect(programIdForWallet(m.wallet_name)).toBe(m.required_program_id)
      expect(walletNamesForProgram(m.required_program_id)).toContain(m.wallet_name)
    }
  })

  it('ЦК split: program_id=1 → share + member', () => {
    expect(walletNamesForProgram(1).sort()).toEqual(['w.wal.member', 'w.wal.share'])
  })

  it('exit-refund сет: ровно три паевых кошелька (minshr + share + blago)', () => {
    expect(LEDGER2_EXIT_REFUND_WALLETS).toEqual(['w.reg.minshr', 'w.wal.share', 'w.cap.blago'])
    // алиас-обёртка ссылается на тот же сет
    expect(EXIT_REFUND_WALLET_NAMES).toEqual(LEDGER2_EXIT_REFUND_WALLETS)
    // каждый кошелёк сета зарегистрирован в реестре
    const known = new Set(LEDGER2_WALLET_REGISTRY.map(w => w.name))
    for (const w of LEDGER2_EXIT_REFUND_WALLETS) expect(known.has(w)).toBe(true)
  })
})
