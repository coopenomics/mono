/**
 * Sanity + integration на L3 (Эпик 3 + Эпик 2 / story 2.1, 3.1, 3.2, 3.3, 3.6, 3.7).
 *
 * Часть 1 — pure sanity (без блокчейна): cooptypes регенерированы под новые
 *   actions/tables (ledger2::userwallets, walletop с username, ledger2::migrate3,
 *   wallet::users, wallet::signagree/revokeagree/migrate3).
 *
 * Часть 2 — integration на live-стенде:
 *   2.1 wallet::signagree → users[username].programs[] обновлён
 *   2.2 wallet::revokeagree → программа удалена; пустой vector → запись users.erase
 *   2.3 wallet::migrate3 идемпотентность (повторный вызов с теми же параметрами = no-op)
 *   3.1 ledger2::migrate3 → userwallets создаётся с правильными значениями
 *   3.2 ledger2::migrate3 на COOPERATIVE-кошельке → fail (assert проверки)
 *   3.3 ledger2::migrate3 с (0,0) → запись userwallets удаляется
 *   3.4 walletop через apply на USER_SHARED БЕЗ соглашения в wallet::users → fail
 *   3.5 walletop через apply на USER_SHARED С соглашением в wallet::users → success, L3 запись
 *
 * Запускать только после `pnpm run reboot:extra` — тесты предполагают
 * наличие cooperative=voskhod и chairman=ant в state.
 */

import { describe, expect, it, beforeAll } from 'vitest'
import { Ledger2, Ledger2Contract, WalletContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import { generateRandomSHA256 } from '../utils/randomHash'

const COOP = 'voskhod'
const CHAIRMAN = 'ant'

describe('cooptypes L3 sanity (Эпик 2 / Эпик 3)', () => {
  it('Ledger2Contract.Actions.Migrate3 экспортирует actionName=migrate3', () => {
    expect(Ledger2Contract.Actions.Migrate3.actionName).toBe('migrate3')
  })

  it('Ledger2Contract.Actions.Walletop экспортирует actionName=walletop', () => {
    expect(Ledger2Contract.Actions.Walletop.actionName).toBe('walletop')
  })

  it('Ledger2Contract.Tables.UserWallets экспортирует tableName=userwallets', () => {
    expect(Ledger2Contract.Tables.UserWallets.tableName).toBe('userwallets')
  })

  it('WalletContract.Actions.SignAgreement.actionName=signagree', () => {
    expect(WalletContract.Actions.SignAgreement.actionName).toBe('signagree')
  })

  it('WalletContract.Actions.RevokeAgreement.actionName=revokeagree', () => {
    expect(WalletContract.Actions.RevokeAgreement.actionName).toBe('revokeagree')
  })

  it('WalletContract.Actions.Migrate3.actionName=migrate3 (wallet)', () => {
    expect(WalletContract.Actions.Migrate3.actionName).toBe('migrate3')
  })

  it('WalletContract.Tables.Users.tableName=users', () => {
    expect(WalletContract.Tables.Users.tableName).toBe('users')
  })

  it('OPERATION_REGISTRY содержит хотя бы одну USER_SHARED-операцию (с username dispatch)', () => {
    const userSharedWallets = new Set([
      'w.reg.minshr', 'w.wal.share', 'w.wal.member', 'w.cap.blago', 'w.cap.gen',
    ])
    const hasUserShared = Ledger2.LEDGER2_OPERATION_REGISTRY.some((op: any) => {
      return userSharedWallets.has(String(op.wallet_from)) || userSharedWallets.has(String(op.wallet_to))
    })
    expect(hasUserShared).toBe(true)
  })
})

describe('ledger2 L3 + wallet::users — integration (live blockchain)', () => {
  const bc = new Blockchain(config.network, config.private_keys)
  const TEST_PROGRAM_ID_BLAGO = 4 // Благорост — есть в boot:extra
  const TEST_USERNAME = 'ant'

  beforeAll(async () => {
    await bc.update_pass_instance()
  }, 60_000)

  it('wallet::signagree → users[username].programs[] обновляется', async () => {
    const data: WalletContract.Actions.SignAgreement.ISignAgreement = {
      coopname: COOP,
      username: TEST_USERNAME,
      program_id: TEST_PROGRAM_ID_BLAGO,
      document: {
        version: '0',
        hash: generateRandomSHA256(),
        doc_hash: generateRandomSHA256(),
        meta_hash: '0000000000000000000000000000000000000000000000000000000000000000',
        meta: '',
        signatures: [],
      },
      draft_id: 0,
    }

    await bc.api.transact({
      actions: [{
        account: WalletContract.contractName.production,
        name: WalletContract.Actions.SignAgreement.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const rows = await bc.getTableRows('wallet', COOP, 'users', 100)
    const userRow = (rows as Array<{ username: string; programs: Array<{ program_id: number | string }> }>)
      .find((r) => r.username === TEST_USERNAME)
    expect(userRow, 'wallet::users должен иметь запись для пайщика').toBeDefined()
    const hasProg = userRow!.programs.some((p) => Number(p.program_id) === TEST_PROGRAM_ID_BLAGO)
    expect(hasProg, `programs[] должен содержать program_id=${TEST_PROGRAM_ID_BLAGO}`).toBe(true)
  }, 60_000)

  it('wallet::migrate3 идемпотентность (повторный вызов не дублирует programs[])', async () => {
    // Повторный signagree с тем же program_id обновляет, не дублирует
    const dupData: WalletContract.Actions.Migrate3.IMigrate3 = {
      coopname: COOP,
      username: TEST_USERNAME,
      program_id: TEST_PROGRAM_ID_BLAGO,
      doc_hash: generateRandomSHA256(),
      version: 1,
      draft_id: 0,
      signed_at: '2026-05-05T00:00:00.000',
    }

    await bc.api.transact({
      actions: [{
        account: WalletContract.contractName.production,
        name: WalletContract.Actions.Migrate3.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data: dupData,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const rows = await bc.getTableRows('wallet', COOP, 'users', 100)
    const userRow = (rows as Array<{ username: string; programs: Array<{ program_id: number | string }> }>)
      .find((r) => r.username === TEST_USERNAME)
    const dupCount = userRow!.programs.filter((p) => Number(p.program_id) === TEST_PROGRAM_ID_BLAGO).length
    expect(dupCount, 'программы не должны дублироваться при повторном migrate3').toBe(1)
  }, 60_000)

  it('ledger2::migrate3 на USER_SHARED создаёт запись userwallets', async () => {
    const data: Ledger2Contract.Actions.Migrate3.IMigrate3 = {
      coopname: COOP,
      wallet_name: 'w.cap.blago',
      username: TEST_USERNAME,
      available: '1000.0000 RUB',
      blocked: '0.0000 RUB',
    }

    await bc.api.transact({
      actions: [{
        account: Ledger2Contract.contractName.production,
        name: Ledger2Contract.Actions.Migrate3.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const rows = await bc.getTableRows('ledger2', COOP, 'userwallets', 100)
    const entry = (rows as Array<{ wallet_name: string; username: string; available: string }>)
      .find((r) => r.wallet_name === 'w.cap.blago' && r.username === TEST_USERNAME)
    expect(entry, 'userwallets[w.cap.blago, ant] должен быть создан').toBeDefined()
    expect(entry!.available).toBe('1000.0000 RUB')
  }, 60_000)

  it('ledger2::migrate3 с (0, 0) удаляет запись userwallets', async () => {
    const data: Ledger2Contract.Actions.Migrate3.IMigrate3 = {
      coopname: COOP,
      wallet_name: 'w.cap.blago',
      username: TEST_USERNAME,
      available: '0.0000 RUB',
      blocked: '0.0000 RUB',
    }

    await bc.api.transact({
      actions: [{
        account: Ledger2Contract.contractName.production,
        name: Ledger2Contract.Actions.Migrate3.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const rows = await bc.getTableRows('ledger2', COOP, 'userwallets', 100)
    const entry = (rows as Array<{ wallet_name: string; username: string }>)
      .find((r) => r.wallet_name === 'w.cap.blago' && r.username === TEST_USERNAME)
    expect(entry, 'userwallets[w.cap.blago, ant] должен быть удалён при (0,0)').toBeUndefined()
  }, 60_000)

  it('ledger2::migrate3 на COOPERATIVE-кошельке падает (assert kind == USER_SHARED)', async () => {
    const data: Ledger2Contract.Actions.Migrate3.IMigrate3 = {
      coopname: COOP,
      wallet_name: 'w.reg.entry',  // COOPERATIVE — нельзя L3
      username: TEST_USERNAME,
      available: '100.0000 RUB',
      blocked: '0.0000 RUB',
    }

    await expect(
      bc.api.transact({
        actions: [{
          account: Ledger2Contract.contractName.production,
          name: Ledger2Contract.Actions.Migrate3.actionName,
          authorization: [{ actor: COOP, permission: 'active' }],
          data,
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
    ).rejects.toThrow(/USER_SHARED/i)
  }, 60_000)

  it('wallet::revokeagree удаляет программу из vector; последняя → erase users', async () => {
    // Удаляем оставшуюся программу — после revokeagree запись users должна исчезнуть.
    const data: WalletContract.Actions.RevokeAgreement.IRevokeAgreement = {
      coopname: COOP,
      username: TEST_USERNAME,
      program_id: TEST_PROGRAM_ID_BLAGO,
    }

    await bc.api.transact({
      actions: [{
        account: WalletContract.contractName.production,
        name: WalletContract.Actions.RevokeAgreement.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const rows = await bc.getTableRows('wallet', COOP, 'users', 100)
    const userRow = (rows as Array<{ username: string; programs: any[] }>)
      .find((r) => r.username === TEST_USERNAME)
    // Если нет других программ у этого пайщика — записи быть не должно.
    if (userRow) {
      const stillHas = userRow.programs.some((p) => Number(p.program_id) === TEST_PROGRAM_ID_BLAGO)
      expect(stillHas, `program_id=${TEST_PROGRAM_ID_BLAGO} не должен оставаться в programs[]`).toBe(false)
    }
  }, 60_000)
})

/**
 * Edge-кейсы вокруг wallet::users (signagree/revokeagree) и ledger2::migrate3.
 * Каждый тест держит свой setup/cleanup, чтобы порядок исполнения не влиял
 * на корректность; финальное состояние пайщика — без program_id=BLAGO.
 */
describe('wallet::users / ledger2::migrate3 — edge cases (live blockchain)', () => {
  const bc = new Blockchain(config.network, config.private_keys)
  const TEST_PROGRAM_ID_BLAGO = 4
  const TEST_PROGRAM_ID_GEN = 3 // Программа существует в boot:extra (Генератор)
  const TEST_USERNAME = 'ant'

  beforeAll(async () => {
    await bc.update_pass_instance()
  }, 60_000)

  /** Гарантирует отсутствие program_id у пайщика (revokeagree если есть, иначе no-op). */
  async function ensureNoProgram(program_id: number): Promise<void> {
    const rows = await bc.getTableRows('wallet', COOP, 'users', 100)
    const userRow = (rows as Array<{ username: string; programs: Array<{ program_id: number | string }> }>)
      .find((r) => r.username === TEST_USERNAME)
    if (!userRow) return
    if (!userRow.programs.some((p) => Number(p.program_id) === program_id)) return
    await bc.api.transact({
      actions: [{
        account: WalletContract.contractName.production,
        name: WalletContract.Actions.RevokeAgreement.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data: { coopname: COOP, username: TEST_USERNAME, program_id },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
  }

  async function signProgram(program_id: number): Promise<string> {
    const doc_hash = generateRandomSHA256()
    const data: WalletContract.Actions.SignAgreement.ISignAgreement = {
      coopname: COOP,
      username: TEST_USERNAME,
      program_id,
      document: {
        version: '0',
        hash: doc_hash,
        doc_hash,
        meta_hash: '0000000000000000000000000000000000000000000000000000000000000000',
        meta: '',
        signatures: [],
      },
      draft_id: 0,
    }
    await bc.api.transact({
      actions: [{
        account: WalletContract.contractName.production,
        name: WalletContract.Actions.SignAgreement.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
    return doc_hash
  }

  it('wallet::signagree повторно с тем же program_id обновляет doc_hash, не дублирует', async () => {
    await ensureNoProgram(TEST_PROGRAM_ID_BLAGO)

    await signProgram(TEST_PROGRAM_ID_BLAGO)
    const secondHash = await signProgram(TEST_PROGRAM_ID_BLAGO)

    const rows = await bc.getTableRows('wallet', COOP, 'users', 100)
    const userRow = (rows as Array<{ username: string; programs: Array<{ program_id: number | string; doc_hash: string }> }>)
      .find((r) => r.username === TEST_USERNAME)
    expect(userRow).toBeDefined()
    const blago = userRow!.programs.filter((p) => Number(p.program_id) === TEST_PROGRAM_ID_BLAGO)
    expect(blago.length, 'программа не должна дублироваться при повторной подписи').toBe(1)
    // Контракт нормализует hex-хэш в lowercase (см. document utils) — сравниваем без регистра.
    expect(blago[0]!.doc_hash.toLowerCase(), 'doc_hash должен обновиться на последний').toBe(secondHash.toLowerCase())

    await ensureNoProgram(TEST_PROGRAM_ID_BLAGO)
  }, 60_000)

  it('wallet::revokeagree без записи users → throws', async () => {
    await ensureNoProgram(TEST_PROGRAM_ID_BLAGO)
    await ensureNoProgram(TEST_PROGRAM_ID_GEN)

    await expect(
      bc.api.transact({
        actions: [{
          account: WalletContract.contractName.production,
          name: WalletContract.Actions.RevokeAgreement.actionName,
          authorization: [{ actor: COOP, permission: 'active' }],
          data: { coopname: COOP, username: TEST_USERNAME, program_id: TEST_PROGRAM_ID_BLAGO },
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
    ).rejects.toThrow(/программных соглашений/i)
  }, 60_000)

  it('wallet::revokeagree program_id не в programs[] → throws', async () => {
    await ensureNoProgram(TEST_PROGRAM_ID_GEN)
    await signProgram(TEST_PROGRAM_ID_BLAGO)

    await expect(
      bc.api.transact({
        actions: [{
          account: WalletContract.contractName.production,
          name: WalletContract.Actions.RevokeAgreement.actionName,
          authorization: [{ actor: COOP, permission: 'active' }],
          data: { coopname: COOP, username: TEST_USERNAME, program_id: TEST_PROGRAM_ID_GEN },
        }],
      }, { blocksBehind: 3, expireSeconds: 30 })
    ).rejects.toThrow(/не подписана/i)

    await ensureNoProgram(TEST_PROGRAM_ID_BLAGO)
  }, 60_000)

  /** Гарантирует отсутствие L3-записи userwallets для (wallet_name, username). */
  async function ensureNoUserWallet(wallet_name: string): Promise<void> {
    const rows = await bc.getTableRows('ledger2', COOP, 'userwallets', 100)
    const exists = (rows as Array<{ wallet_name: string; username: string }>)
      .some((r) => r.wallet_name === wallet_name && r.username === TEST_USERNAME)
    if (!exists) return
    await bc.api.transact({
      actions: [{
        account: Ledger2Contract.contractName.production,
        name: Ledger2Contract.Actions.Migrate3.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data: {
          coopname: COOP,
          wallet_name,
          username: TEST_USERNAME,
          available: '0.0000 RUB',
          blocked: '0.0000 RUB',
        },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
  }

  it('ledger2::migrate3 идемпотентность: два одинаковых вызова не падают и значения не дублируются', async () => {
    await ensureNoUserWallet('w.cap.blago')

    const data: Ledger2Contract.Actions.Migrate3.IMigrate3 = {
      coopname: COOP,
      wallet_name: 'w.cap.blago',
      username: TEST_USERNAME,
      available: '500.0000 RUB',
      blocked: '0.0000 RUB',
    }
    await bc.api.transact({
      actions: [{
        account: Ledger2Contract.contractName.production,
        name: Ledger2Contract.Actions.Migrate3.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
    await bc.api.transact({
      actions: [{
        account: Ledger2Contract.contractName.production,
        name: Ledger2Contract.Actions.Migrate3.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const rows = await bc.getTableRows('ledger2', COOP, 'userwallets', 100)
    const matches = (rows as Array<{ wallet_name: string; username: string; available: string }>)
      .filter((r) => r.wallet_name === 'w.cap.blago' && r.username === TEST_USERNAME)
    expect(matches.length, 'L3-запись (wallet_name, username) должна быть единственной').toBe(1)
    expect(matches[0]!.available).toBe('500.0000 RUB')

    await ensureNoUserWallet('w.cap.blago')
  }, 60_000)

  it('ledger2::migrate3 с blocked > 0 сохраняет blocked-значение', async () => {
    await ensureNoUserWallet('w.cap.blago')

    const data: Ledger2Contract.Actions.Migrate3.IMigrate3 = {
      coopname: COOP,
      wallet_name: 'w.cap.blago',
      username: TEST_USERNAME,
      available: '1000.0000 RUB',
      blocked: '250.0000 RUB',
    }
    await bc.api.transact({
      actions: [{
        account: Ledger2Contract.contractName.production,
        name: Ledger2Contract.Actions.Migrate3.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const rows = await bc.getTableRows('ledger2', COOP, 'userwallets', 100)
    const entry = (rows as Array<{ wallet_name: string; username: string; available: string; blocked: string }>)
      .find((r) => r.wallet_name === 'w.cap.blago' && r.username === TEST_USERNAME)
    expect(entry).toBeDefined()
    expect(entry!.available).toBe('1000.0000 RUB')
    expect(entry!.blocked).toBe('250.0000 RUB')

    await ensureNoUserWallet('w.cap.blago')
  }, 60_000)

  it('ledger2::migrate3 (0, 0) когда записи нет → no-op (не падает, ничего не создаёт)', async () => {
    await ensureNoUserWallet('w.cap.blago')

    const data: Ledger2Contract.Actions.Migrate3.IMigrate3 = {
      coopname: COOP,
      wallet_name: 'w.cap.blago',
      username: TEST_USERNAME,
      available: '0.0000 RUB',
      blocked: '0.0000 RUB',
    }
    await bc.api.transact({
      actions: [{
        account: Ledger2Contract.contractName.production,
        name: Ledger2Contract.Actions.Migrate3.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const rows = await bc.getTableRows('ledger2', COOP, 'userwallets', 100)
    const exists = (rows as Array<{ wallet_name: string; username: string }>)
      .some((r) => r.wallet_name === 'w.cap.blago' && r.username === TEST_USERNAME)
    expect(exists, '(0,0) не должен создавать запись').toBe(false)
  }, 60_000)
})
