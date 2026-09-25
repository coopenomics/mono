/**
 * Лента изменений цепи (test-registry/realtime.chain-changes.yaml).
 *
 * Подписка `chainChanges` отдаёт сигнал «строка изменилась, перечитай» — без
 * данных строки. Каналы выбирает сервер: таблица, открытая всем, — общий
 * канал; личная — владельцу строки и совету; служебная — только совету.
 *
 * Изменения готовятся паевым взносом и расторжением соглашения прямо в цепи
 * (номера блоков известны) и мутациями контроллера, которые пишут в базу узла
 * (настройки кооператива, платёж пайщика, способ оплаты в генераторе). Сигналы свои тест узнаёт
 * по номеру блока либо по ключу строки: файлы идут по очереди на общем
 * стенде, чужих изменений в эти моменты нет, но и на пустоту каналов тест не
 * полагается.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core'
import { CHAIRMAN, COOP, COOP_SIGNER, COUNCIL, ROLES, caseName, deposit, freshMember, gql, login, tableRows, tokenOf, transact } from '../core'
import type { WsConn } from './platform-a.helpers'
import {
  WS_FORBIDDEN,
  chainChangesOf,
  chainDeposit,
  mirroredAvailable,
  quietWindow,
  settleSubscriptions,
  signalsOf,
  typeFields,
  waitSignal,
  wsAs,
  wsRejectionCode,
} from './platform-a.helpers'

const USERWALLETS = { code: 'ledger2', table: 'userwallets' }
const WALLET_USERS = { code: 'wallet', table: 'users' }
const LEDGER_ACCOUNTS = { code: 'ledger2', table: 'accounts' }
const COOP_WALLETS = { code: 'ledger2', table: 'wallets' }
const SETTINGS = { code: 'core', table: 'settings' }
const PAYMENT_METHODS = { code: 'core', table: 'payment_methods' }
const PAYMENTS = { code: 'core', table: 'payments' }

const STAFF_ONLY = new Set(['ledger2::accounts', 'ledger2::wallets'])
const key = (s: { code: string, table: string }): string => `${s.code}::${s.table}`

describe('realtime.chain-changes: лента изменений — сигнал к дочитке, каналы по праву', () => {
  let member: Who
  let memberToken: string
  let otherToken: string
  let councilToken: string
  const conns: WsConn[] = []

  async function open(token: string): Promise<WsConn> {
    const c = await wsAs(token)
    conns.push(c)
    return c
  }

  beforeAll(async () => {
    member = freshMember({ prefix: 'rtcc' })
    memberToken = await login(member)
    otherToken = await tokenOf(ROLES.otherMember())
    councilToken = await tokenOf(COUNCIL)
  })

  afterAll(() => {
    for (const c of conns) c.close()
  })

  describe('паевой взнос в цепи: личные и служебные таблицы', () => {
    // Подписки открываются до взноса; сам взнос — две транзакции, их блоки.
    const subs: Record<string, ReturnType<typeof chainChangesOf>> = {}
    let dep: Awaited<ReturnType<typeof chainDeposit>>
    let availableBefore = 0
    let availableAtSignal = 0

    beforeAll(async () => {
      const memberConn = await open(memberToken)
      const otherConn = await open(otherToken)
      const councilConn = await open(councilToken)
      subs.member = chainChangesOf(memberConn, [USERWALLETS])
      subs.memberAll = chainChangesOf(memberConn)
      subs.other = chainChangesOf(otherConn, [USERWALLETS])
      subs.council = chainChangesOf(councilConn, [USERWALLETS])
      subs.councilAll = chainChangesOf(councilConn)
      subs.councilStaff = chainChangesOf(councilConn, [LEDGER_ACCOUNTS, COOP_WALLETS])
      availableBefore = await mirroredAvailable(memberToken, member.account)
      await settleSubscriptions()

      dep = await chainDeposit(member.account, 250)

      // Дочитка по сигналу — сразу, как только он пришёл: сигнал обещает, что
      // изменение его блока уже в базе узла.
      await waitSignal(subs.member, { ...USERWALLETS, block_num: dep.completeBlock })
      availableAtSignal = await mirroredAvailable(memberToken, member.account)

      await waitSignal(subs.council, { ...USERWALLETS, block_num: dep.completeBlock })
      await quietWindow()
    })

    it(caseName('rt.cc.happy.02', 'строка личной таблицы: сигнал владельцу и совету, чужому пайщику — нет'), async () => {
      const mine = signalsOf(subs.member, { ...USERWALLETS, block_num: dep.completeBlock })
      expect(mine.length).toBeGreaterThan(0)
      expect(signalsOf(subs.council, { ...USERWALLETS, block_num: dep.completeBlock }).length).toBeGreaterThan(0)
      // Чужой пайщик подписан на ту же таблицу, но строка не его: общего
      // канала у личной таблицы нет.
      const leaked = signalsOf(subs.other).filter(s => s.block_num === dep.createBlock || s.block_num === dep.completeBlock)
      expect(leaked).toEqual([])
      // Сигнал — адрес строки, без её данных.
      expect(Object.keys(mine[0]).sort()).toEqual(['block_num', 'code', 'primary_key', 'scope', 'table'])
      expect(mine[0].scope).toBe(COOP)
    })

    it(caseName('rt.cc.side.02', 'дельта необъявленной таблицы сигнала не даёт'), async () => {
      // В тех же блоках меняется wallet::deposits — таблица, которой в ленте нет.
      // Совет подписан на всё, что лента объявляет, и её сигналов не видит.
      const ours = signalsOf(subs.councilAll).filter(s => s.block_num === dep.createBlock || s.block_num === dep.completeBlock)
      expect(ours.length).toBeGreaterThan(0)
      expect(ours.filter(s => s.code === 'wallet' && s.table === 'deposits')).toEqual([])
    })

    it(caseName('rt.cc.side.04', 'по сигналу читается уже записанное: остаток виден в зеркале в момент прихода сигнала'), async () => {
      expect(availableAtSignal).toBeCloseTo(availableBefore + 250, 4)
    })

    it(caseName('rt.cc.happy.03', 'каналы выбирает сервер: пайщику общие и свои строки, совету все; перечень таблиц сужает'), async () => {
      const block = dep.completeBlock
      // Пайщик без перечня получает свою строку личной таблицы…
      expect(signalsOf(subs.memberAll, { ...USERWALLETS, block_num: block }).length).toBeGreaterThan(0)
      // …но не служебные таблицы учёта, которые тот же блок изменил.
      const staffForMember = signalsOf(subs.memberAll).filter(s => s.block_num === block && STAFF_ONLY.has(key(s)))
      expect(staffForMember).toEqual([])
      // Совет получает служебные, а перечень оставляет только названные таблицы.
      const staffForCouncil = signalsOf(subs.councilStaff).filter(s => s.block_num === block)
      expect(staffForCouncil.length).toBeGreaterThan(0)
      expect(staffForCouncil.every(s => STAFF_ONLY.has(key(s)))).toBe(true)
      expect(signalsOf(subs.councilAll).filter(s => s.block_num === block && STAFF_ONLY.has(key(s))).length).toBeGreaterThan(0)
      // Перечень пайщика — одна личная таблица; ничего сверх неё.
      expect(signalsOf(subs.member).every(s => key(s) === key(USERWALLETS))).toBe(true)
    })
  })

  describe('база узла: открытая таблица и запись в генератор', () => {
    it(caseName('rt.cc.happy.01', 'строка открытой таблицы: сигнал в общий канал всем пайщикам, без данных строки'), async () => {
      const memberSub = chainChangesOf(await open(memberToken), [SETTINGS])
      const otherSub = chainChangesOf(await open(otherToken))
      await settleSubscriptions()

      const chairmanToken = await tokenOf(CHAIRMAN)
      const before = await gql<any>(null, 'query{ getSystemInfo{ settings{ provider_name } } }')
      await gql(chairmanToken, 'mutation($d:UpdateSettingsInput!){ updateSettings(data:$d){ updated_at } }', {
        d: { provider_name: before.getSystemInfo.settings.provider_name },
      })

      const a = await waitSignal(memberSub, { ...SETTINGS })
      const b = await waitSignal(otherSub, { ...SETTINGS })
      expect(a).toEqual({ ...SETTINGS, scope: COOP, primary_key: a.primary_key, block_num: 0 })
      expect(b.primary_key).toBe(a.primary_key)
      // В типе сигнала только адрес строки — данных строки он не несёт.
      expect(await typeFields(memberToken, 'ChainChange')).toEqual(['block_num', 'code', 'primary_key', 'scope', 'table'])
    })

    it(caseName('rt.cc.happy.04', 'запись в объявленную таблицу базы узла: сигнал с блоком 0 после фиксации'), async () => {
      const sub = chainChangesOf(await open(memberToken), [SETTINGS])
      await settleSubscriptions()

      const chairmanToken = await tokenOf(CHAIRMAN)
      const before = await gql<any>(null, 'query{ getSystemInfo{ settings{ provider_name updated_at } } }')
      const res = await gql<any>(chairmanToken, 'mutation($d:UpdateSettingsInput!){ updateSettings(data:$d){ updated_at } }', {
        d: { provider_name: before.getSystemInfo.settings.provider_name },
      })
      const written = res.updateSettings.updated_at as string
      expect(written).not.toBe(before.getSystemInfo.settings.updated_at)

      const sig = await sub.waitFor(e => (e.chainChanges?.table === 'settings' ? e.chainChanges : null), 60_000, 'сигнала настроек')
      // Сигнал базы узла — блок 0; и приходит он после фиксации: чтение по
      // сигналу видит уже записанное.
      const after = await gql<any>(null, 'query{ getSystemInfo{ settings{ updated_at } } }')
      expect(sig.block_num).toBe(0)
      expect(after.getSystemInfo.settings.updated_at).toBe(written)
    })

    it(caseName('rt.cc.happy.08', 'приход шлюза (паевой взнос) — сигнал пайщику по таблице приходов'), async () => {
      // До 25.09.2026 контракта gateway не было в публикации индексера, и лента
      // по приходам и выплатам шлюза молчала — кошелёк по ним не обновлялся.
      const INCOMES = { code: 'gateway', table: 'incomes' }
      const sub = chainChangesOf(await open(memberToken), [INCOMES])
      await settleSubscriptions()
      await deposit(member.account, 100)
      const sig = await waitSignal(sub, INCOMES)
      expect(sig.primary_key).not.toBe('')
    })

    it(caseName('rt.cc.happy.06', 'корзина Стола заказов — личная таблица: сигнал приходит заказчику с ключом строки'), async () => {
      // До 25.09.2026 корзина менялась частичным update, сигнал терял владельца
      // и уходил только совету с пустым ключом — стол заказчика не обновлялся.
      const orderer = ROLES.member()
      const ordererToken = await tokenOf(orderer)
      const CART = { code: 'market', table: 'marketplace_cart' }
      const sub = chainChangesOf(await open(ordererToken), [CART])
      await settleSubscriptions()
      await gql(ordererToken, 'mutation{ marketplaceClearCart{ __typename } }')
      const sig = await waitSignal(sub, CART)
      expect(sig.primary_key).not.toBe('')
    })

    it(caseName('rt.cc.happy.04', 'личная таблица базы узла: сигнал о новой строке — её владельцу по ключу строки, чужому — нет'), async () => {
      const ownSub = chainChangesOf(await open(memberToken), [PAYMENTS])
      const otherSub = chainChangesOf(await open(otherToken), [PAYMENTS])
      await settleSubscriptions()

      const pay = await gql<any>(memberToken, `mutation($d:CreateDepositPaymentInput!){
        createDepositPayment(data:$d){ id }
      }`, { d: { username: member.account, quantity: 777, symbol: 'RUB' } })
      const id = String(pay.createDepositPayment.id)

      const sig = await waitSignal(ownSub, { ...PAYMENTS, primary_key: id })
      expect(sig).toEqual({ ...PAYMENTS, scope: COOP, primary_key: id, block_num: 0 })
      await quietWindow()
      expect(signalsOf(otherSub, { primary_key: id })).toEqual([])
    })

    it(caseName('rt.cc.happy.07', 'запись в генератор (способ оплаты пайщика): сигнал владельцу и совету, чужому — нет'), async () => {
      const ownSub = chainChangesOf(await open(memberToken), [PAYMENT_METHODS])
      const otherSub = chainChangesOf(await open(otherToken), [PAYMENT_METHODS])
      const councilSub = chainChangesOf(await open(councilToken), [PAYMENT_METHODS])
      await settleSubscriptions()

      const added = await gql<any>(memberToken, `mutation($d:AddPaymentMethodInput!){
        addPaymentMethod(data:$d){ method_id username }
      }`, { d: { username: member.account, is_default: false, sbp_data: { phone: '+79990001122' } } })

      const mine = { ...PAYMENT_METHODS, primary_key: member.account, block_num: 0 }
      await waitSignal(ownSub, mine)
      await waitSignal(councilSub, mine)
      expect(added.addPaymentMethod.username).toBe(member.account)
      await quietWindow()

      expect(signalsOf(otherSub, { primary_key: member.account })).toEqual([])
    })
  })

  describe('снятая строка личной таблицы', () => {
    it(caseName('rt.cc.side.01', 'строка личной таблицы снята — владельца в ней нет, сигнал только совету'), async () => {
      const ownSub = chainChangesOf(await open(memberToken), [WALLET_USERS])
      const councilSub = chainChangesOf(await open(councilToken), [WALLET_USERS])
      await settleSubscriptions()

      // Программные соглашения пайщика — строка wallet::users; расторжение
      // последнего стирает её целиком.
      const row = (await tableRows<any>('wallet', COOP, 'users')).find(r => r.username === member.account)
      expect(row?.programs?.length).toBeGreaterThan(0)
      let lastBlock = 0
      for (const p of row.programs as any[]) {
        const tx = await transact(COOP_SIGNER, [{
          account: 'wallet',
          name: 'revokeagree',
          data: { coopname: COOP, username: member.account, program_id: p.program_id },
        }])
        lastBlock = Number(tx.processed.block_num)
      }

      await waitSignal(councilSub, { ...WALLET_USERS, block_num: lastBlock })
      await quietWindow()
      expect(signalsOf(ownSub, { block_num: lastBlock })).toEqual([])
    })
  })

  describe('отказы по праву', () => {
    it(caseName('rt.cc.break.01', 'необъявленная таблица, чужой кооператив, соединение без пайщика — отказ'), async () => {
      const conn = await open(memberToken)

      const undeclared = await chainChangesOf(conn, [{ code: 'wallet', table: 'deposits' }]).failure()
      expect(undeclared.code).toBe('BLOCKCHAIN_CHANGES_TABLE_NOT_IN_FEED')

      const foreign = await chainChangesOf(conn, [USERWALLETS], 'othercoop').failure()
      expect(foreign.code).toBe('BLOCKCHAIN_CHANGES_FOREIGN_COOPERATIVE')

      // Без пайщика соединение не открывается вовсе.
      expect(await wsRejectionCode(null)).toBe(WS_FORBIDDEN)
    })
  })
})
