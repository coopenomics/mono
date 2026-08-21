/**
 * Контрактный уровень: энергия и уровни участника ЦПП «Благорост»
 * (реестр capital.gamification, level contract).
 *
 * Уровень набирается энергией, энергия — вкладами:
 *
 *   требование(N) = level_depth_base × level_growth_coefficient^(N−1)
 *   начисление    = вклад / требование(текущий) × 100 × коэффициент_прироста
 *   уровень растёт, пока накопленная энергия ≥ 100
 *
 * Множитель 100 в формуле — не украшение: без него доля вклада от требования
 * уходила бы в энергию как 0..1, начисление выходило бы ровно в сто раз
 * меньше, и на уровень требовался бы миллион вместо десяти тысяч. Интерфейс
 * при этом считает по верной формуле и подсказывает пайщику сумму, от которой
 * он не увидел бы никакого движения. Поэтому основной ассерт здесь — «вклад
 * размером подсказки поднимает РОВНО на один уровень».
 *
 * Все ожидания считаются от ЖИВОЙ конфигурации кооператива, а не от зашитых
 * чисел: тест не сломается от смены ставок и остаётся верным на любом стенде.
 *
 * Тест самодостаточен: каждый случай заводит своего пайщика.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { WalletContract } from 'cooptypes'
import Blockchain from '../blockchain'
import config from '../configs'
import {
  COOP,
  type CapitalConfig,
  amountForOneLevel,
  applyContribution,
  bootstrapMember,
  energyGain,
  getCapitalConfig,
  getContributor,
  levelRequirement,
  minor,
  programInvest,
} from './capital/programInvest'
import { capitalProgramId } from './capital/consts'

const bc = new Blockchain(config.network, config.private_keys)
let cfg: CapitalConfig

/** Энергия — double, сравниваем с допуском, а не побитово. */
const ENERGY_TOLERANCE = 0.01

describe('Благорост — энергия и уровни участника (contract, живая цепь)', () => {
  beforeAll(async () => {
    await bc.update_pass_instance()
    cfg = await getCapitalConfig(bc)
    expect(cfg.level_depth_base, 'базовая сумма уровня обязана быть задана').toBeGreaterThan(0)
    expect(cfg.energy_gain_coefficient, 'коэффициент прироста обязан быть положительным').toBeGreaterThan(0)
  }, 120_000)

  it('cap.gam.happy.01 + cap.gam.break.01: вклад размером подсказки даёт ровно 100 энергии и ровно один уровень', async () => {
    const member = await bootstrapMember(bc)
    const before = await getContributor(bc, member)
    const level = Number(before.level)
    const energyBefore = Number.parseFloat(before.energy)

    // Ровно та сумма, которую интерфейс показывает как «до следующего уровня».
    const hinted = amountForOneLevel(level, cfg)
    expect(energyGain(hinted, level, cfg),
      'сумма подсказки по определению обязана давать 100 энергии').toBeCloseTo(100, 6)

    const model = applyContribution(hinted, level, energyBefore, cfg)

    await programInvest(bc, member, hinted)

    const after = await getContributor(bc, member)
    expect(model.levelsGained,
      'вклад размером подсказки обязан поднять РОВНО на один уровень: без множителя 100 в формуле '
      + 'начисление было бы в сто раз меньше и пайщик не увидел бы движения',
    ).toBe(1)
    expect(Number(after.level), 'и цепь обязана согласиться с моделью').toBe(model.level)
    // Остаток уходит уже на СЛЕДУЮЩИЙ уровень, а его требование выше в
    // коэффициент роста раз — поэтому сравниваем с моделью, а не с нулём.
    expect(Number.parseFloat(after.energy),
      'остаток обязан лечь на следующий уровень по его собственному требованию',
    ).toBeCloseTo(model.energy, ENERGY_TOLERANCE)
  }, 600_000)

  it('cap.gam.side.01: вклад, кратно перекрывающий требование, поднимает сразу на несколько уровней', async () => {
    const member = await bootstrapMember(bc)
    const before = await getContributor(bc, member)
    const level = Number(before.level)

    // Три с половиной «подсказки». Начисление складывается с уже накопленной
    // энергией, поэтому сколько именно будет переходов — считаем моделью
    // контракта, а не «на глаз»: остаток мог добросить ещё один уровень.
    // Вклад, заведомо перекрывающий несколько уровней. Сколько именно будет
    // переходов — считаем моделью контракта: требование каждого следующего
    // уровня выше предыдущего, поэтому «делить на сотню» нельзя.
    const oneLevel = amountForOneLevel(level, cfg)
    const contribution = oneLevel * 6
    const model = applyContribution(contribution, level, Number.parseFloat(before.energy), cfg)

    expect(model.levelsGained,
      'ожидание ветки: вклад кратно перекрывает требование и даёт НЕСКОЛЬКО переходов').toBeGreaterThanOrEqual(3)
    expect(model.levelsGained,
      'и заметно меньше, чем дало бы линейное деление на сотню — рост требования работает',
    ).toBeLessThan(6)

    await programInvest(bc, member, contribution)

    const after = await getContributor(bc, member)
    expect(Number(after.level),
      'уровень обязан вырасти ровно на столько ступеней, сколько покрывает вклад с учётом роста требования',
    ).toBe(model.level)
    expect(Number.parseFloat(after.energy),
      'остатком энергии обязана стать недобранная доля последнего уровня',
    ).toBeCloseTo(model.energy, ENERGY_TOLERANCE)
  }, 600_000)

  it('cap.gam.side.02: нулевая и отрицательная сумма не начисляют энергию и не двигают уровень', async () => {
    const member = await bootstrapMember(bc)
    const before = await getContributor(bc, member)

    await expect(programInvest(bc, member, 0)).rejects.toThrow()
    await expect(programInvest(bc, member, -minor(100))).rejects.toThrow()

    const after = await getContributor(bc, member)
    expect(Number(after.level), 'уровень не должен измениться').toBe(Number(before.level))
    expect(Number.parseFloat(after.energy), 'энергия не должна начислиться').toBeCloseTo(Number.parseFloat(before.energy), ENERGY_TOLERANCE)
  }, 600_000)

  it('cap.gam.side.03: требование растёт с уровнем — тот же вклад на следующем уровне даёт меньше энергии ровно во столько же раз', async () => {
    const member = await bootstrapMember(bc)
    const start = await getContributor(bc, member)
    const level = Number(start.level)

    // Первый вклад поднимает на уровень и обнуляет остаток.
    const step = amountForOneLevel(level, cfg)
    await programInvest(bc, member, step)

    const afterFirst = await getContributor(bc, member)
    expect(Number(afterFirst.level), 'предусловие: первый вклад поднял на уровень').toBe(level + 1)

    // Тот же вклад на следующем уровне — начисление обязано упасть ровно в
    // level_growth_coefficient раз, потому что во столько же выросло требование.
    await programInvest(bc, member, step)

    // Начисление нельзя мерить разницей энергии «до/после»: переход уровня
    // обнуляет её. Сравниваем с моделью контракта целиком.
    const expectedGain = energyGain(step, level + 1, cfg)
    const model = applyContribution(step, Number(afterFirst.level), Number.parseFloat(afterFirst.energy), cfg)

    const afterSecond = await getContributor(bc, member)

    expect(expectedGain,
      'ожидание ветки: на следующем уровне то же вложение даёт меньше 100 энергии').toBeLessThan(100)
    expect(expectedGain * cfg.level_growth_coefficient,
      'начисление обязано упасть ровно во столько раз, во сколько выросло требование уровня',
    ).toBeCloseTo(energyGain(step, level, cfg), ENERGY_TOLERANCE)
    expect(Number.parseFloat(afterSecond.energy),
      'остаток энергии обязан сойтись с моделью уменьшенного начисления',
    ).toBeCloseTo(model.energy, ENERGY_TOLERANCE)
    expect(Number(afterSecond.level),
      'и уровень обязан сойтись с моделью').toBe(model.level)

    expect(levelRequirement(level + 1, cfg) / levelRequirement(level, cfg),
      'требование обязано расти именно на коэффициент роста').toBeCloseTo(cfg.level_growth_coefficient, 4)
  }, 600_000)

  it('cap.gam.side.04: вклад участника без кошелька в программе отклоняется ДО начисления энергии', async () => {
    const member = await bootstrapMember(bc)
    const before = await getContributor(bc, member)

    // Единственный достижимый способ остаться без кошелька программы —
    // отозвать соглашение после регистрации договора (regcontrib его требует
    // либо подписывает сам).
    await bc.api.transact({
      actions: [{
        account: WalletContract.contractName.production,
        name: WalletContract.Actions.RevokeAgreement.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data: { coopname: COOP, username: member, program_id: capitalProgramId },
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    await expect(programInvest(bc, member, amountForOneLevel(Number(before.level), cfg)))
      .rejects.toThrow(/нет кошелька в программе благороста/i)

    const after = await getContributor(bc, member)
    expect(Number(after.level), 'уровень не должен вырасти на отклонённом вкладе').toBe(Number(before.level))
    expect(Number.parseFloat(after.energy), 'энергия не должна начислиться на отклонённом вкладе')
      .toBeCloseTo(Number.parseFloat(before.energy), ENERGY_TOLERANCE)
  }, 600_000)

  it('cap.gam.side.08: статус договора об участии в формулу не входит — неодобренному начисляется так же', async () => {
    const approved = await bootstrapMember(bc)
    const pending = await bootstrapMember(bc, { approveContract: false })

    const pendingBefore = await getContributor(bc, pending)
    expect(pendingBefore.status, 'предусловие ветки: договор не одобрен председателем').not.toBe('active')

    const approvedBefore = await getContributor(bc, approved)
    expect(Number(pendingBefore.level), 'оба пайщика стартуют с одного уровня').toBe(Number(approvedBefore.level))

    const step = amountForOneLevel(Number(approvedBefore.level), cfg)
    await programInvest(bc, approved, step)
    await programInvest(bc, pending, step)

    const approvedAfter = await getContributor(bc, approved)
    const pendingAfter = await getContributor(bc, pending)

    expect(Number(pendingAfter.level),
      'уровень неодобренного обязан вырасти так же, как у одобренного').toBe(Number(approvedAfter.level))
    expect(Number.parseFloat(pendingAfter.energy),
      'и остаток энергии обязан совпасть — статус договора в формулу не входит',
    ).toBeCloseTo(Number.parseFloat(approvedAfter.energy), ENERGY_TOLERANCE)
  }, 900_000)
})
