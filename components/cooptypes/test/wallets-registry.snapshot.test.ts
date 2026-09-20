import { describe, expect, it } from 'vitest'
import {
  EXIT_BLOCKER_WALLET_RULES,
  EXIT_REFUND_WALLET_NAMES,
  exitRuleForWallet,
  LEDGER2_EXIT_WALLET_POLICY,
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
      if (m.required_program_id <= 0)
        continue
      expect(programIdForWallet(m.wallet_name)).toBe(m.required_program_id)
      expect(walletNamesForProgram(m.required_program_id)).toContain(m.wallet_name)
    }
  })

  it('ЦК split: program_id=1 → share + member', () => {
    expect(walletNamesForProgram(1).sort()).toEqual(['w.wal.member', 'w.wal.share'])
  })

  // Что выход делает с кошельком, задаёт таблица политики (exit_policy.hpp), а
  // не вид взноса: свободный паевой «Стола заказов» возвращается с 07.09.2026,
  // членский взнос «Образования» — с 20.09.2026 (п. 4.2.5 его Положения).
  it('возврат при выходе: паевые кошельки и членский взнос «Образования»', () => {
    expect([...LEDGER2_EXIT_REFUND_WALLETS].sort()).toEqual(
      ['w.cap.blago', 'w.edu.member', 'w.mkt.share', 'w.reg.minshr', 'w.wal.share'],
    )
    // алиас-обёртка ссылается на тот же сет
    expect(EXIT_REFUND_WALLET_NAMES).toEqual(LEDGER2_EXIT_REFUND_WALLETS)
    // каждый кошелёк сета зарегистрирован в реестре
    const known = new Set(LEDGER2_WALLET_REGISTRY.map(w => w.name))
    for (const w of LEDGER2_EXIT_REFUND_WALLETS) expect(known.has(w)).toBe(true)
  })

  it('политика выхода: у каждого пользовательского кошелька есть строка', () => {
    const covered = new Set(LEDGER2_EXIT_WALLET_POLICY.map(r => r.wallet_name))
    for (const w of LEDGER2_WALLET_REGISTRY) {
      if (w.kind === 'USER_SHARED') expect(covered.has(w.name)).toBe(true)
    }
    // главный паевой один, и он цель сбора
    const main = LEDGER2_EXIT_WALLET_POLICY.filter(r => r.policy === 'MAIN')
    expect(main.map(r => r.wallet_name)).toEqual(['w.wal.share'])
    // операция переноса есть ровно у возвращаемых кошельков
    for (const r of LEDGER2_EXIT_WALLET_POLICY) {
      expect(Boolean(r.transfer_op)).toBe(r.policy === 'RETURN_TO_MAIN')
    }
  })

  it('выход держат резерв под заказы и незакрытый подотчёт', () => {
    expect(EXIT_BLOCKER_WALLET_RULES.map(r => r.wallet_name).sort()).toEqual(['w.exp.adv', 'w.mkt.order'])
    for (const r of EXIT_BLOCKER_WALLET_RULES) expect(r.note.length).toBeGreaterThan(0)
  })

  it('членский взнос «Стола заказов» остаётся кооперативу', () => {
    expect(exitRuleForWallet('w.mkt.member')?.policy).toBe('FORFEIT')
    expect(exitRuleForWallet('w.edu.member')?.policy).toBe('RETURN_TO_MAIN')
    expect(exitRuleForWallet('w.edu.member')?.transfer_op).toBe('o.edu.retshr')
    expect(exitRuleForWallet('w.sov.fund')).toBeUndefined()
  })
})
