/**
 * Sanity + integration на финальный реестр кошельков и упрощённый WalletOp
 * (Super-story 1.1+1.2+1.3 эпика «L3 в ledger2»).
 *
 * Часть 1 — pure sanity (без блокчейна): cooptypes-зеркало контрактного реестра
 *   соответствует архитектуре (ADR-002 / ADR-003 / ADR-009 / ADR-010):
 *     • Финальный набор кошельков (5 USER_SHARED + 6 COOPERATIVE = 11)
 *     • WalletOp без WALLET_ONLY/REVOKE, с BURN
 *     • TRANSFER без бухпроводок маркируется (debit==null && credit==null) —
 *       НЕ через специальный op-code (o.cap.invest)
 *     • Capital операции используют только унифицированные кошельки
 *       w.cap.{blago,gen,loan} — никаких старых bginv/gncom/bgrid
 *     • Все wallet_from/wallet_to стандартных операций ⊆ реестр кошельков
 *
 * Часть 2 — integration: blockchain ledger2::wallets после migrate содержит
 *   только имена из финального реестра (никаких stale-имён) и accounts2 имеет
 *   корректную структуру.
 */

import { describe, expect, it, beforeAll } from 'vitest'
import { Ledger2 } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'

const COOP = 'voskhod'
const LEDGER2 = 'ledger2'

// ── Финальный реестр (ADR-002, ADR-009): эталонные имена ──────────────────────
const EXPECTED_USER_SHARED = [
  'w.reg.minshr',
  'w.wal.share',
  'w.wal.member',
  'w.cap.blago',
  'w.cap.gen',
] as const

const EXPECTED_COOPERATIVE = [
  'w.reg.entry',
  'w.wal.wthdrw',
  'w.sov.infra',
  'w.sov.delgte',
  'w.cap.loan',
  'w.mkt.payout',
] as const

const ALL_VALID_NAMES = new Set<string>([...EXPECTED_USER_SHARED, ...EXPECTED_COOPERATIVE])

// Имена, которые мы умышленно удалили — не должны встречаться нигде в реестре
// или в blockchain wallets table.
const FORBIDDEN_LEGACY_NAMES = [
  'w.wal.sharid',
  'w.cap.bginv',
  'w.cap.gncom',
  'w.cap.bgrid',
  'w.wal.cash',
] as const

const EXPECTED_WALLET_OPS = ['ISSUE', 'TRANSFER', 'BLOCK', 'UNBLOCK', 'BURN'] as const

describe('ledger2 wallet registry — sanity (cooptypes ↔ архитектура)', () => {
  it('LEDGER2_WALLET_REGISTRY содержит ровно 11 кошельков (5 USER_SHARED + 6 COOPERATIVE)', () => {
    expect(Ledger2.LEDGER2_WALLET_REGISTRY).toHaveLength(11)

    const userShared = Ledger2.LEDGER2_WALLET_REGISTRY.filter((w) => w.kind === 'USER_SHARED').map((w) => w.name)
    const cooperative = Ledger2.LEDGER2_WALLET_REGISTRY.filter((w) => w.kind === 'COOPERATIVE').map((w) => w.name)

    expect(userShared.sort()).toEqual([...EXPECTED_USER_SHARED].sort())
    expect(cooperative.sort()).toEqual([...EXPECTED_COOPERATIVE].sort())
  })

  it('никаких удалённых stale-имён (sharid/bginv/gncom/bgrid/wal.cash) в реестре', () => {
    const names = Ledger2.LEDGER2_WALLET_REGISTRY.map((w) => w.name)
    for (const forbidden of FORBIDDEN_LEGACY_NAMES) {
      expect(names, `wallet ${forbidden} должен быть удалён из реестра`).not.toContain(forbidden)
    }
  })

  it('getWalletKind возвращает корректный kind для каждого имени', () => {
    for (const name of EXPECTED_USER_SHARED) {
      expect(Ledger2.getWalletKind(name)).toBe('USER_SHARED')
    }
    for (const name of EXPECTED_COOPERATIVE) {
      expect(Ledger2.getWalletKind(name)).toBe('COOPERATIVE')
    }
    expect(Ledger2.getWalletKind('w.wal.sharid')).toBeUndefined()
    expect(Ledger2.getWalletKind(null)).toBeUndefined()
    expect(Ledger2.getWalletKind('')).toBeUndefined()
  })

  it('USER_SHARED имена соответствуют конвенции w.<contract>.<waltype> (ADR-010 compile-time)', () => {
    const userShared = Ledger2.LEDGER2_WALLET_REGISTRY.filter((w) => w.kind === 'USER_SHARED')
    for (const w of userShared) {
      expect(w.name, `USER_SHARED имя должно начинаться с w.`).toMatch(/^w\.[a-z]{2,3}\.[a-z0-9]+$/)
    }
  })
})

describe('ledger2 OPERATION_REGISTRY — sanity (WalletOp cleanup, ADR-003 / ADR-009)', () => {
  it('WalletOp в каждой записи ∈ {ISSUE, TRANSFER, BLOCK, UNBLOCK, BURN} ∪ null (adjustment)', () => {
    for (const op of Ledger2.LEDGER2_OPERATION_REGISTRY) {
      if (op.kind === 'adjustment') {
        expect(op.wallet_op, `adjustment ${op.code} должна иметь wallet_op == null`).toBeNull()
      } else {
        expect(EXPECTED_WALLET_OPS, `${op.code}: WalletOp ${op.wallet_op} устарел или неизвестен`).toContain(op.wallet_op)
      }
    }
  })

  it('никаких упоминаний устаревших WALLET_ONLY/REVOKE в реестре операций', () => {
    for (const op of Ledger2.LEDGER2_OPERATION_REGISTRY) {
      expect(op.wallet_op as unknown, `${op.code}: WALLET_ONLY должен быть удалён`).not.toBe('WALLET_ONLY')
      expect(op.wallet_op as unknown, `${op.code}: REVOKE должен быть удалён, заменён BURN`).not.toBe('REVOKE')
    }
  })

  it('все wallet_from/wallet_to стандартных операций ⊆ финальный реестр (плюс null)', () => {
    for (const op of Ledger2.LEDGER2_OPERATION_REGISTRY) {
      if (op.kind === 'adjustment') continue
      if (op.wallet_from !== null) {
        expect(ALL_VALID_NAMES, `${op.code}: wallet_from ${op.wallet_from} не из финального реестра`).toContain(op.wallet_from)
      }
      if (op.wallet_to !== null) {
        expect(ALL_VALID_NAMES, `${op.code}: wallet_to ${op.wallet_to} не из финального реестра`).toContain(op.wallet_to)
      }
    }
  })

  it('zero_accounts_iff_both: debit==null ⇔ credit==null (ADR-003)', () => {
    for (const op of Ledger2.LEDGER2_OPERATION_REGISTRY) {
      if (op.kind === 'adjustment') continue
      const debitNull = op.debit === null
      const creditNull = op.credit === null
      expect(debitNull, `${op.code}: debit/credit должны оба быть null или оба заданы`).toBe(creditNull)
    }
  })

  it('o.cap.invest — TRANSFER без бухпроводок (заменил WALLET_ONLY, ADR-009)', () => {
    const invest = Ledger2.LEDGER2_OPERATION_REGISTRY.find((o) => o.code === 'o.cap.invest')
    expect(invest, 'операция o.cap.invest должна существовать').toBeDefined()
    expect(invest!.wallet_op).toBe('TRANSFER')
    expect(invest!.debit).toBeNull()
    expect(invest!.credit).toBeNull()
    expect(invest!.wallet_from).toBe('w.wal.share')
    expect(invest!.wallet_to).toBe('w.cap.blago')
  })

  it('capital операции используют только унифицированные w.cap.{blago,gen,loan} (ADR-009)', () => {
    const allowedCapitalWallets = new Set(['w.cap.blago', 'w.cap.gen', 'w.cap.loan', 'w.wal.share'])
    const capitalOps = Ledger2.LEDGER2_OPERATION_REGISTRY.filter((o) => o.contract === 'capital')
    expect(capitalOps.length, 'capital должен иметь ≥5 операций после ADR-009').toBeGreaterThanOrEqual(5)

    for (const op of capitalOps) {
      for (const w of [op.wallet_from, op.wallet_to]) {
        if (!w) continue
        expect(allowedCapitalWallets, `${op.code}: capital использует устаревший кошелёк ${w}`).toContain(w)
      }
    }
  })

  it('o.mig.rid удалён из реестра — миграция не сплитит legacy 80 на share+rid', () => {
    const migRid = Ledger2.LEDGER2_OPERATION_REGISTRY.find((o) => o.code === 'o.mig.rid')
    expect(migRid, 'операция o.mig.rid должна быть удалена (Super-story 1.1)').toBeUndefined()
  })

  it('adjustment операции (o.adj.*) имеют kind=adjustment и null-параметры', () => {
    const adjustments = Ledger2.LEDGER2_OPERATION_REGISTRY.filter((o) => o.kind === 'adjustment')
    expect(adjustments.length).toBeGreaterThanOrEqual(2) // o.adj.walmove + o.adj.rev

    for (const op of adjustments) {
      expect(op.wallet_op).toBeNull()
      expect(op.wallet_from).toBeNull()
      expect(op.wallet_to).toBeNull()
      expect(op.debit).toBeNull()
      expect(op.credit).toBeNull()
      expect(op.code).toMatch(/^o\.adj\./)
    }

    expect(adjustments.map((a) => a.code).sort()).toEqual(['o.adj.rev', 'o.adj.walmove'])
  })
})

// ── Часть 2: integration с живым blockchain ───────────────────────────────────
describe('ledger2 wallet registry — integration (blockchain ledger2::wallets)', () => {
  const bc = new Blockchain(config.network, config.private_keys)

  beforeAll(async () => {
    await bc.update_pass_instance()
  }, 60_000)

  it('on-chain wallets ⊆ финальный реестр (нет stale-имён, нет вне-реестровых)', async () => {
    // На свежем чейне таблица может быть пустой до migrate / первой регистрации —
    // это валидно. Проверяем строго: всё что есть, должно быть из финального реестра.
    const rows = await bc.getTableRows(LEDGER2, COOP, 'wallets', 200)
    const onChainNames = (rows as Array<{ id: string }>).map((r) => String(r.id))

    for (const forbidden of FORBIDDEN_LEGACY_NAMES) {
      expect(onChainNames, `blockchain содержит устаревший wallet ${forbidden}`).not.toContain(forbidden)
    }

    for (const onChain of onChainNames) {
      expect(ALL_VALID_NAMES, `blockchain содержит wallet ${onChain} вне финального реестра`).toContain(onChain)
    }
  }, 60_000)

  it('после регистрации пайщика (spread_initial=true) появляются w.reg.minshr (USER_SHARED) и w.reg.entry (COOPERATIVE)', async () => {
    // Прямой adduser с spread_initial=true — это единственный путь, где registrator::adduser
    // эмитит ОБЕ операции: o.reg.putmin (USER_SHARED w.reg.minshr) + o.reg.payent (COOPERATIVE w.reg.entry).
    // addUser2 helper хардкодит spread_initial=false и отсекает PAY_ENTRANCE, поэтому идём напрямую.
    const { RegistratorContract } = await import('cooptypes')
    const { generateRandomUsername } = await import('../utils/randomUsername')
    const { generateRandomSHA256 } = await import('../utils/randomHash')

    const username = generateRandomUsername()
    const account = await bc.generateKeypair(username, undefined, 'Аккаунт участника')

    const data: RegistratorContract.Actions.AddUser.IAddUser = {
      coopname: COOP,
      referer: '',
      username: account.username,
      type: 'individual',
      created_at: '2025-02-05T09:34:27',
      initial: '100.0000 RUB',
      minimum: '100.0000 RUB',
      spread_initial: true,
      meta: '',
      registration_hash: generateRandomSHA256(),
    }

    await bc.api.transact({
      actions: [
        {
          account: RegistratorContract.contractName.production,
          name: RegistratorContract.Actions.AddUser.actionName,
          authorization: [{ actor: COOP, permission: 'active' }],
          data,
        },
      ],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const rows = await bc.getTableRows(LEDGER2, COOP, 'wallets', 200)
    const onChainNames = new Set((rows as Array<{ id: string }>).map((r) => String(r.id)))

    expect(onChainNames.has('w.reg.minshr'), 'w.reg.minshr должен появиться после регистрации (ISSUE PUT_MINSHARE)').toBe(true)
    expect(onChainNames.has('w.reg.entry'), 'w.reg.entry должен появиться после регистрации (ISSUE PAY_ENTRANCE)').toBe(true)

    // Регрессия: после регистрации НЕ должно быть никаких stale-имён.
    for (const forbidden of FORBIDDEN_LEGACY_NAMES) {
      expect(onChainNames.has(forbidden), `stale ${forbidden} не должен появиться`).toBe(false)
    }
  }, 240_000)
})
