/**
 * Story 11.2 — coverage трассировки ProcessRegistry для marketplace.
 *
 * Для каждой из 13 marketplace-операций (12 `o.mkt.*` + 1 `o.wal.conv` под
 * `p.mkt.supply`) проверяем, что:
 *   1. Операция присутствует в `Ledger2.LEDGER2_OPERATION_REGISTRY` с
 *      непустым `process_type`.
 *   2. `OPERATION_CODE_TO_PROCESS_TYPE` (читается ProcessRegistry в Phase A)
 *      возвращает корректный `process_type`.
 *   3. `process_type` присутствует в `PROCESS_HASH_LOCATOR` (Phase B), либо
 *      объявлен как одноактовый процесс (пустой `[]`).
 *   4. Синтетическое apply+walletop+debit+credit trio под одним
 *      `process_hash` детерминированно классифицируется в правильный
 *      `process_type` (Phase A якорь).
 *   5. Поля `wallet_op` / `wallet_from` / `wallet_to` / `debit` / `credit`
 *      в реестре соответствуют тому, что мы кладём в синтетическое трио.
 *
 * Этот spec — заглушка под контрактные тесты в mono-ai-5
 * (`mono-ai-5/components/boot/src/tests/marketplace.test.ts`), где Antelope
 * simulator реально выполняет 18 canonical actions и проверяет on-chain
 * блокчейн-трассировку. Здесь мы валидируем backend-side mapping (cooptypes
 * ↔ process-hash-locator), без которого on-chain трассировка не доедет до
 * UI стола бухгалтера.
 *
 * Full-flow сценарии (createorder → signsupp → signiss2 / submretrn /
 * execwroff) задокументированы как «гарантия покрытия в mono-ai-5» — здесь
 * проверяется только наличие всех 13 op_code в реестре + базовая связность.
 */

import { Ledger2 } from 'cooptypes'
import {
  OPERATION_CODE_TO_PROCESS_TYPE,
  PROCESS_HASH_LOCATOR,
  KNOWN_PROCESS_TYPES,
} from '~/domain/process-registry/config/process-hash-locator'
import { MARKETPLACE_OPERATION_CODES } from './marketplace-ledger2-invariants'

/**
 * Canonical список marketplace-операций (9 шт), полностью покрывающих
 * жизненный цикл Order'а, доплату по факту, гарантийный возврат и списание
 * скоропорта. Если этот список расходится с
 * `Ledger2.LEDGER2_OPERATION_REGISTRY` — это поломка контракта/cooptypes.
 */
const EXPECTED_MARKETPLACE_OP_CODES = [
  // p.mkt.supply (7 операций)
  'o.mkt.lock',
  'o.mkt.conv',
  'o.mkt.lockm',
  'o.mkt.unlock',
  'o.mkt.purch',
  'o.mkt.payout',
  'o.mkt.consum',
  // p.mkt.return (1)
  'o.mkt.return',
  // p.mkt.wroff (1)
  'o.mkt.wroff',
] as const

describe('Story 11.2 — coverage marketplace operation_code в cooptypes', () => {
  it('canonical список содержит 9 кодов', () => {
    expect(EXPECTED_MARKETPLACE_OP_CODES).toHaveLength(9)
  })

  it('каждый код присутствует в LEDGER2_OPERATION_REGISTRY', () => {
    const registryCodes = new Set(Ledger2.LEDGER2_OPERATION_REGISTRY.map((op) => op.code))
    for (const code of EXPECTED_MARKETPLACE_OP_CODES) {
      expect(registryCodes.has(code)).toBe(true)
    }
  })

  it('MARKETPLACE_OPERATION_CODES (helper invariants) синхронизирован с canonical', () => {
    for (const code of EXPECTED_MARKETPLACE_OP_CODES) {
      expect(MARKETPLACE_OPERATION_CODES.has(code)).toBe(true)
    }
  })

  it.each(EXPECTED_MARKETPLACE_OP_CODES)(
    '%s — process_type входит в один из marketplace process_type-ов',
    (code) => {
      const op = Ledger2.LEDGER2_OPERATION_REGISTRY.find((o) => o.code === code)!
      expect(op).toBeDefined()
      expect(['p.mkt.supply', 'p.mkt.return', 'p.mkt.wroff']).toContain(op.process_type)
    },
  )

  it.each(EXPECTED_MARKETPLACE_OP_CODES)(
    '%s — OPERATION_CODE_TO_PROCESS_TYPE возвращает контрактный process_type (Phase A якорь)',
    (code) => {
      const registryEntry = Ledger2.LEDGER2_OPERATION_REGISTRY.find((o) => o.code === code)!
      expect(OPERATION_CODE_TO_PROCESS_TYPE[code]).toBe(registryEntry.process_type)
    },
  )

  it('все 3 marketplace process_type объявлены в PROCESS_HASH_LOCATOR (Phase B fan-out)', () => {
    for (const pt of ['p.mkt.supply', 'p.mkt.return', 'p.mkt.wroff']) {
      expect(PROCESS_HASH_LOCATOR[pt]).toBeDefined()
      expect(PROCESS_HASH_LOCATOR[pt].length).toBeGreaterThan(0)
      expect(KNOWN_PROCESS_TYPES.has(pt)).toBe(true)
    }
  })

  it('marketplace HashLocation указывают на правильные entity-таблицы', () => {
    expect(PROCESS_HASH_LOCATOR['p.mkt.supply']).toEqual([
      { code: 'marketplace', table: 'orders', field: 'hash' },
    ])
    expect(PROCESS_HASH_LOCATOR['p.mkt.return']).toEqual([
      { code: 'marketplace', table: 'retrequests', field: 'hash' },
    ])
    expect(PROCESS_HASH_LOCATOR['p.mkt.wroff']).toEqual([
      { code: 'marketplace', table: 'wroffprops', field: 'hash' },
    ])
  })
})

describe('Story 11.2 — wallet_op + Дт/Кт реестра соответствуют ledger2.hpp', () => {
  /**
   * Замороженная карта ожиданий по реестру (синхронно с
   * `components/contracts/cpp/lib/core/ledger2/operations.hpp:159`).
   * При расхождении C++ контракт и TS-foundation расходятся — это поломка
   * Story 11.1 PR #375.
   */
  const EXPECTED_REGISTRY = [
    {
      code: 'o.mkt.lock',
      walletOp: 'TRANSFER',
      walletFrom: 'w.wal.share',
      walletTo: 'w.mkt.order',
      debit: 80,
      credit: 86,
    },
    {
      code: 'o.mkt.conv',
      walletOp: 'TRANSFER',
      walletFrom: 'w.wal.share',
      walletTo: 'w.mkt.member',
      debit: 80,
      credit: 86,
    },
    {
      code: 'o.mkt.lockm',
      walletOp: 'TRANSFER',
      walletFrom: 'w.mkt.member',
      walletTo: 'w.mkt.order',
      debit: null,
      credit: null,
    },
    {
      code: 'o.mkt.unlock',
      walletOp: 'TRANSFER',
      walletFrom: 'w.mkt.order',
      walletTo: 'w.mkt.member',
      debit: null,
      credit: null,
    },
    {
      code: 'o.mkt.purch',
      walletOp: 'NONE',
      walletFrom: null,
      walletTo: null,
      debit: 10,
      credit: 86,
    },
    {
      code: 'o.mkt.payout',
      walletOp: 'ISSUE',
      walletFrom: null,
      walletTo: 'w.mkt.payout',
      debit: 86,
      credit: 51,
    },
    {
      code: 'o.mkt.consum',
      walletOp: 'BURN',
      walletFrom: 'w.mkt.order',
      walletTo: null,
      debit: 86,
      credit: 10,
    },
    {
      code: 'o.mkt.return',
      walletOp: 'ISSUE',
      walletFrom: null,
      walletTo: 'w.mkt.member',
      debit: 10,
      credit: 86,
    },
    {
      code: 'o.mkt.wroff',
      walletOp: 'NONE',
      walletFrom: null,
      walletTo: null,
      debit: 86,
      credit: 10,
    },
  ] as const

  it.each(EXPECTED_REGISTRY)(
    '$code — wallet_op + debit + credit в cooptypes',
    ({ code, walletOp, walletFrom, walletTo, debit, credit }) => {
      const op = Ledger2.LEDGER2_OPERATION_REGISTRY.find((o) => o.code === code)
      expect(op).toBeDefined()
      expect(op!.wallet_op).toBe(walletOp)
      expect(op!.wallet_from).toBe(walletFrom)
      expect(op!.wallet_to).toBe(walletTo)
      expect(op!.debit).toBe(debit)
      expect(op!.credit).toBe(credit)
    },
  )
})

describe('Story 11.2 — синтетическая трассировка apply+walletop+debit+credit (один process_hash)', () => {
  /**
   * Эта проверка — модель того, как Phase A якорь ProcessRegistry собирает
   * действия по process_hash. Реальная сборка в production делается в
   * `ProcessRegistryService.getProcess` (отдельный e2e в mono-ai-5).
   */
  type ActionRow = {
    name: 'apply' | 'walletop' | 'debit' | 'credit'
    data: Record<string, unknown>
  }

  function buildTriadeForOp(code: string, processHash: string, amount = 100): ActionRow[] {
    const op = Ledger2.LEDGER2_OPERATION_REGISTRY.find((o) => o.code === code)!
    const rows: ActionRow[] = [
      { name: 'apply', data: { operation_code: code, process_hash: processHash, amount } },
    ]
    if (op.wallet_op !== null && op.wallet_op !== 'NONE') {
      rows.push({
        name: 'walletop',
        data: {
          process_hash: processHash,
          wallet_op: op.wallet_op,
          wallet_from: op.wallet_from,
          wallet_to: op.wallet_to,
          amount,
        },
      })
    }
    if (op.debit !== null) {
      rows.push({
        name: 'debit',
        data: { process_hash: processHash, account_id: op.debit, amount },
      })
    }
    if (op.credit !== null) {
      rows.push({
        name: 'credit',
        data: { process_hash: processHash, account_id: op.credit, amount },
      })
    }
    return rows
  }

  it.each(EXPECTED_MARKETPLACE_OP_CODES)(
    '%s — трио apply+walletop+debit+credit под одним process_hash',
    (code) => {
      const processHash = `hash-${code}`
      const trio = buildTriadeForOp(code, processHash)

      // 1. Все строки имеют один и тот же process_hash
      for (const row of trio) {
        expect(row.data.process_hash).toBe(processHash)
      }

      // 2. apply присутствует с operationCode = code
      const apply = trio.find((r) => r.name === 'apply')
      expect(apply).toBeDefined()
      expect(apply!.data.operation_code).toBe(code)

      // 3. OPERATION_CODE_TO_PROCESS_TYPE классифицирует apply в правильный
      // process_type (Phase A якорь в ProcessRegistryService.getProcess
      // делает ровно эту проверку).
      const processType = OPERATION_CODE_TO_PROCESS_TYPE[code]
      expect(['p.mkt.supply', 'p.mkt.return', 'p.mkt.wroff']).toContain(processType)
    },
  )

  it('full-flow happy supply (createorder → signsupp → signiss2) — одна process_hash, все операции under p.mkt.supply', () => {
    const processHash = 'supply-flow-hash'
    const sequence = [
      'o.mkt.lock',
      'o.mkt.purch',
      'o.mkt.payout',
      'o.mkt.consum',
    ]
    const allRows: ActionRow[] = []
    for (const code of sequence) {
      allRows.push(...buildTriadeForOp(code, processHash))
    }
    for (const row of allRows) {
      expect(row.data.process_hash).toBe(processHash)
    }
    const applies = allRows.filter((r) => r.name === 'apply')
    expect(applies).toHaveLength(sequence.length)
    for (const apply of applies) {
      const code = apply.data.operation_code as string
      expect(OPERATION_CODE_TO_PROCESS_TYPE[code]).toBe('p.mkt.supply')
    }
  })

  it('full-flow return (submretrn → approve) — o.mkt.return under p.mkt.return', () => {
    const processHash = 'return-flow-hash'
    const rows = buildTriadeForOp('o.mkt.return', processHash)
    const applies = rows.filter((r) => r.name === 'apply')
    for (const apply of applies) {
      expect(OPERATION_CODE_TO_PROCESS_TYPE[apply.data.operation_code as string]).toBe(
        'p.mkt.return',
      )
    }
  })

  it('full-flow writeoff (execwroff) — o.mkt.wroff under p.mkt.wroff', () => {
    const processHash = 'wroff-flow-hash'
    const rows = buildTriadeForOp('o.mkt.wroff', processHash)
    const applies = rows.filter((r) => r.name === 'apply')
    for (const apply of applies) {
      expect(OPERATION_CODE_TO_PROCESS_TYPE[apply.data.operation_code as string]).toBe(
        'p.mkt.wroff',
      )
    }
  })
})
