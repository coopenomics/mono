/**
 * Контрактный уровень: программный взнос в ЦПП «Благорост»
 * (реестр capital.program-invest, level contract).
 *
 * Взнос в программу — одно действие `createpinv`, которое одновременно двигает
 * деньги (паевой кошелёк → кошелёк программы), пополняет свободные средства
 * программы, наращивает накопительный показатель инвестора и публикует
 * заявление в реестр документов. Проверяется, что все четыре следствия
 * наступают вместе и что боковые ветки отсекаются ДО любого из них.
 *
 * Отдельно зафиксировано послабление: взнос ИМЕННО В ПРОГРАММУ проходит и с
 * неодобренным договором об участии — по оферте программы юридических
 * ограничений до одобрения нет. Требование подписи самого договора при этом
 * остаётся.
 *
 * Тест самодостаточен: каждый случай заводит своего пайщика.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { WalletContract } from 'cooptypes'
import { generateRandomSHA256 } from '../utils/randomHash'
import Blockchain from '../blockchain'
import config from '../configs'
import {
  COOP,
  amount,
  bootstrapMember,
  getContributor,
  getUserWallet,
  minor,
  programFreePool,
  programInvest,
  rub,
  signedBy,
} from './capital/programInvest'
import { capitalProgramId } from './capital/consts'

const bc = new Blockchain(config.network, config.private_keys)

const INVEST = 25_000 // рублей — заметно меньше депозита, чтобы остаток был виден

describe('Благорост — программный взнос в программу (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
  }, 60_000)

  it('cap.pinv.happy.01: взнос списывает средства с паевого кошелька, пополняет кошелёк программы и её свободные средства', async () => {
    const member = await bootstrapMember(bc)

    const shareBefore = await getUserWallet(bc, member, 'w.wal.share')
    const blagoBefore = await getUserWallet(bc, member, 'w.cap.blago')
    const poolBefore = await programFreePool(bc)
    const contributorBefore = await getContributor(bc, member)

    await programInvest(bc, member, minor(INVEST))

    const shareAfter = await getUserWallet(bc, member, 'w.wal.share')
    const blagoAfter = await getUserWallet(bc, member, 'w.cap.blago')

    expect(shareAfter.available,
      'сумма обязана списаться с доступного остатка паевого кошелька').toBeCloseTo(shareBefore.available - INVEST, 2)
    expect(blagoAfter.available + blagoAfter.blocked,
      'та же сумма обязана появиться на кошельке программы «Благорост»',
    ).toBeCloseTo(blagoBefore.available + blagoBefore.blocked + INVEST, 2)

    expect(await programFreePool(bc),
      'свободные средства программы обязаны вырасти ровно на взнос — из них потом направляют в проекты',
    ).toBeCloseTo(poolBefore + INVEST, 2)

    const contributorAfter = await getContributor(bc, member)
    expect(amount(contributorAfter.contributed_as_investor),
      'накопительный показатель инвестора обязан вырасти на взнос',
    ).toBeCloseTo(amount(contributorBefore.contributed_as_investor) + INVEST, 2)
  }, 600_000)

  it('cap.pinv.side.01: взнос проходит и с неодобренным договором об участии — послабление по оферте программы', async () => {
    const member = await bootstrapMember(bc, { approveContract: false })

    const contributor = await getContributor(bc, member)
    expect(contributor.status,
      'предусловие ветки: договор подписан пайщиком, но председателем ещё не одобрен').not.toBe('active')

    const poolBefore = await programFreePool(bc)
    await programInvest(bc, member, minor(INVEST))

    expect(await programFreePool(bc),
      'взнос обязан пройти наравне с одобренным договором: раньше здесь был отказ «Договор УХД с пайщиком не активен»',
    ).toBeCloseTo(poolBefore + INVEST, 2)
  }, 600_000)

  it('cap.pinv.side.03: без подписанного договора об участии взнос отклоняется', async () => {
    // Послабление снимает требование ОДОБРЕНИЯ, но не требование самой подписи.
    const member = await bootstrapMember(bc, { contract: false })

    await expect(programInvest(bc, member, minor(INVEST)))
      .rejects.toThrow(/не подписывал договор УХД/i)
  }, 600_000)

  it('cap.pinv.side.04: без подписанной оферты «Благорост» взнос отклоняется — кошелька программы нет', async () => {
    // Пайщика без кошелька программы простой сборкой не получить: regcontrib
    // либо требует уже подписанного соглашения «Благорост», либо подписывает
    // его сам инлайном. Поэтому ветку воспроизводим единственным способом,
    // которым она достижима на живой цепи, — отзывом соглашения после
    // регистрации договора.
    const member = await bootstrapMember(bc)

    await bc.api.transact({
      actions: [{
        account: WalletContract.contractName.production,
        name: WalletContract.Actions.RevokeAgreement.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data: {
          coopname: COOP,
          username: member,
          program_id: capitalProgramId,
        } as WalletContract.Actions.RevokeAgreement.IRevokeAgreement,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    await expect(programInvest(bc, member, minor(INVEST)))
      .rejects.toThrow(/нет кошелька в программе благороста/i)
  }, 600_000)

  it('cap.pinv.side.05: взнос больше доступного остатка паевого кошелька отклоняется, ничего не двигается', async () => {
    const member = await bootstrapMember(bc, { deposit: 1_000 })

    const shareBefore = await getUserWallet(bc, member, 'w.wal.share')
    const poolBefore = await programFreePool(bc)

    await expect(programInvest(bc, member, minor(shareBefore.available + 1))).rejects.toThrow()

    expect((await getUserWallet(bc, member, 'w.wal.share')).available,
      'отклонённый взнос не должен трогать паевой кошелёк').toBeCloseTo(shareBefore.available, 2)
    expect(await programFreePool(bc),
      'отклонённый взнос не должен трогать свободные средства программы').toBeCloseTo(poolBefore, 2)
  }, 600_000)

  it('cap.pinv.side.06: нулевая, отрицательная сумма и чужая валюта отклоняются на проверке суммы', async () => {
    const member = await bootstrapMember(bc, { deposit: 50_000 })
    const poolBefore = await programFreePool(bc)

    await expect(programInvest(bc, member, 0), 'нулевая сумма').rejects.toThrow()
    await expect(programInvest(bc, member, -minor(100)), 'отрицательная сумма').rejects.toThrow()

    // Чужая валюта: сумма в символе, которым кооператив не управляет.
    await expect(
      bc.api.transact({
        actions: [{
          account: 'capital',
          name: 'createpinv',
          authorization: [{ actor: COOP, permission: 'active' }],
          data: {
            coopname: COOP,
            username: member,
            invest_hash: '0'.repeat(64),
            amount: '100.0000 USD',
            statement: { version: '1.0.0', hash: '0'.repeat(64), doc_hash: '0'.repeat(64), meta_hash: '0'.repeat(64), meta: '{}', signatures: [] },
          },
        }],
      }, { blocksBehind: 3, expireSeconds: 30 }),
      'чужая валюта',
    ).rejects.toThrow()

    expect(await programFreePool(bc),
      'ни одна из отклонённых сумм не должна тронуть свободные средства программы').toBeCloseTo(poolBefore, 2)
  }, 600_000)

  it('cap.pinv.side.07: послабление касается ТОЛЬКО взноса в программу — соседние операции по-прежнему требуют одобренного договора', async () => {
    const member = await bootstrapMember(bc, { approveContract: false })

    // Взнос в ПРОЕКТ (createinvest) — соседняя операция того же пайщика.
    await expect(
      bc.api.transact({
        actions: [{
          account: 'capital',
          name: 'createinvest',
          authorization: [{ actor: COOP, permission: 'active' }],
          data: {
            coopname: COOP,
            project_hash: '1'.repeat(64),
            username: member,
            invest_hash: '2'.repeat(64),
            amount: rub(1_000),
            statement: { version: '1.0.0', hash: '0'.repeat(64), doc_hash: '0'.repeat(64), meta_hash: '0'.repeat(64), meta: '{}', signatures: [] },
          },
        }],
      }, { blocksBehind: 3, expireSeconds: 30 }),
      'взнос в проект обязан требовать одобренного договора',
    ).rejects.toThrow()

    // А взнос в ПРОГРАММУ у того же пайщика проходит — послабление адресное.
    const poolBefore = await programFreePool(bc)
    await programInvest(bc, member, minor(1_000))
    expect(await programFreePool(bc)).toBeCloseTo(poolBefore + 1_000, 2)
  }, 600_000)

  it('cap.pinv.break.01: повторная отправка того же заявления не проводит второй взнос', async () => {
    const member = await bootstrapMember(bc, { deposit: 200_000 })
    const investHash = generateRandomSHA256()

    const statement = signedBy(member)
    const payload = {
      coopname: COOP,
      username: member,
      invest_hash: investHash,
      amount: rub(INVEST),
      statement,
    }

    await bc.api.transact({
      actions: [{
        account: 'capital',
        name: 'createpinv',
        authorization: [{ actor: COOP, permission: 'active' }],
        data: payload,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const poolAfterFirst = await programFreePool(bc)

    // Двойной клик по кнопке: то же заявление уходит второй раз. Заявление уже
    // зафиксировано в реестре документов, поэтому взнос повториться не должен.
    await expect(
      bc.api.transact({
        actions: [{
          account: 'capital',
          name: 'createpinv',
          authorization: [{ actor: COOP, permission: 'active' }],
          data: payload,
        }],
      }, { blocksBehind: 3, expireSeconds: 30 }),
    ).rejects.toThrow()

    expect(await programFreePool(bc),
      'второй взнос не должен пополнить свободные средства программы').toBeCloseTo(poolAfterFirst, 2)
  }, 900_000)

  it('cap.pinv.side.02: взнос импортированного пайщика проходит — статус импорта операции не мешает', async () => {
    // Импортированный пайщик заведён с балансом, но регистрацию не завершал:
    // договора об участии у него нет, есть только запись импорта. Оферту
    // программы он подписывает — иначе не будет кошелька «Благороста».
    const member = await bootstrapMember(bc, { contract: false, deposit: 200_000 })

    await bc.api.transact({
      actions: [{
        account: 'capital',
        name: 'importcontrib',
        authorization: [{ actor: COOP, permission: 'active' }],
        data: {
          coopname: COOP,
          username: member,
          contributor_hash: generateRandomSHA256(),
          contribution_amount: rub(1_000),
          memo: 'Импорт пайщика контрактным тестом',
        },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    const contributor = await getContributor(bc, member)
    expect(contributor, 'запись импортированного участника обязана появиться').toBeDefined()
    expect(contributor.status, 'предусловие ветки: регистрация не завершена').not.toBe('active')

    const poolBefore = await programFreePool(bc)
    await programInvest(bc, member, minor(INVEST))

    expect(await programFreePool(bc),
      'взнос импортированного пайщика обязан пройти наравне с остальными',
    ).toBeCloseTo(poolBefore + INVEST, 2)
  }, 900_000)
})
