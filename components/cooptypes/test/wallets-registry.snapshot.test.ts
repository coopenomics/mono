import { describe, expect, it } from 'vitest'
import {
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
})
