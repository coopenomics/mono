/* eslint-disable node/prefer-global/process */
/**
 * Засев стенда для сюиты документации «экономика участка по итогу месяца»
 * (docs-harness, bin/run-marketplace-keu-all.mjs).
 *
 * Участок получает членский взнос первого числа по итогу месяца (99D-23): из
 * обеспечительной части паевых взносов ему достаются его расходы. Фаза ведёт
 * тот же путь, что набор marketplace/economy.test.ts в своей подготовке: заказ
 * от корзины до выдачи, плановый расход участка на сумму обеспечительной
 * части в периоде конца гарантии, итог месяца — и взнос оседает в общем
 * кошельке участка krg. Плановый расход после итога снимается, поэтому сумма
 * доступна распределению.
 *
 * Стенд обязан жить на сжатом времени (`stack.sh standtime compress`): итог
 * месяца — функция времени, в настоящем времени фаза его не дождётся. Идёт до
 * первого входа пайщиков со стола: вход ставит пароль и меняет ключ в цепи, а
 * фаза подписывает ключами фикстур.
 *
 *   esno src/seed/mktkeu/index.ts 01-common
 */
import { tokenOf } from '../../core/auth'
import { ROLES } from '../../core/roles'
import { amount } from '../../core/wallet'
import { KRG, pickOffer } from '../../marketplace/flow'
import { branchEconomy, chargeIntoCommon, issuedOrder } from '../../marketplace/mkt-flows.helpers'

const log = (...a: unknown[]) => console.error('[seed-mktkeu]', ...a)

/** Предложение засева стенда (seed-marketplace, фаза каталога) — берётся по названию. */
const OFFER_NAME = 'Мёд цветочный'
const QUANTITY = 3

/** 01 — на общем кошельке участка krg лежит членский взнос по итогу месяца. */
async function phase01(): Promise<void> {
  const chair = ROLES.branchChairman()
  const chairToken = await tokenOf(chair)
  const before = amount((await branchEconomy(chairToken, KRG)).common_balance)
  if (before > 0) {
    log(`общий кошелёк участка ${KRG} уже с остатком ${before} — фаза пропущена`)
    return
  }
  const member = ROLES.member()
  const supplier = ROLES.supplier()
  const offer = await pickOffer(supplier.account, KRG, OFFER_NAME)
  const issued = await issuedOrder({ member, supplier, operator: chair, offer, quantity: QUANTITY })
  log(`заказ ${issued.orderId} выдан пайщику ${member.account}`)
  const charged = await chargeIntoCommon({ member, orderId: issued.orderId, orderHash: issued.orderHash })
  log(`обеспечительная часть списана по итогу месяца: ${charged}`)
  const after = amount((await branchEconomy(chairToken, KRG)).common_balance)
  if (!(after > before)) {
    throw new Error(`общий кошелёк участка ${KRG} не вырос после итога месяца: было ${before}, стало ${after}`)
  }
  log(`общий кошелёк участка ${KRG}: ${after}`)
}

const PHASES: Record<string, () => Promise<void>> = {
  '01-common': phase01,
}

async function main(): Promise<void> {
  const names = process.argv.slice(2)
  if (!names.length) {
    console.error(`Usage: seed-mktkeu <фаза>\nФазы: ${Object.keys(PHASES).join(', ')}`)
    process.exit(2)
  }
  for (const name of names) {
    const phase = PHASES[name]
    if (!phase) {
      console.error(`Нет фазы «${name}». Фазы: ${Object.keys(PHASES).join(', ')}`)
      process.exit(2)
    }
    log(`▸ ${name}`)
    await phase()
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
