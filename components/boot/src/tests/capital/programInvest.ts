/**
 * Сборка пайщика ЦПП «Благорост» и сам программный взнос — общая часть
 * контрактных тестов `capital.program-invest` и `capital.gamification`
 * (оба слайса крутятся вокруг одного действия `createpinv`).
 *
 * Здесь только ДЕЙСТВИЯ и чтение состояния; ассерты живут в тестах.
 */
import { CapitalContract } from 'cooptypes'
import { addUser } from '../../init/participant'
import { generateRandomSHA256 } from '../../utils/randomHash'
import { generateRandomUsername } from '../../utils/randomUsername'
import { fakeDocument } from '../shared/fakeDocument'
import { signCapitalAgreement } from './signCapitalAgreement'
import { depositToWallet } from '../wallet/depositToWallet'
import { processApprove } from './processApprove'
import { ratePerHour } from './consts'

export const COOP = 'voskhod'

/** Асинхронная копия fakeDocument с подписью нужного пайщика. */
export function signedBy(username: string) {
  return {
    ...fakeDocument,
    signatures: [{ ...fakeDocument.signatures[0], signer: username }],
  }
}

export function rub(n: number) {
  return `${n.toFixed(4)} RUB`
}

export function amount(a: unknown) {
  return Number.parseFloat(String(a ?? '0').split(' ')[0])
}

/** Сумма в минорных единицах (точность рубля — 4 знака). */
export function minor(rubles: number) {
  return Math.round(rubles * 10_000)
}

export interface CapitalConfig {
  level_depth_base: number
  level_growth_coefficient: number
  energy_gain_coefficient: number
  expense_pool_percent: number
}

export async function getCapitalConfig(bc: any): Promise<CapitalConfig> {
  const rows = await bc.getTableRows(CapitalContract.contractName.production, 'capital', 'state', 10) as any[]
  const st = rows.find(r => r.coopname === COOP)
  if (!st) throw new Error('контракт capital не инициализирован на стенде (нет строки state)')
  return {
    level_depth_base: Number(st.config.level_depth_base),
    level_growth_coefficient: Number.parseFloat(st.config.level_growth_coefficient),
    energy_gain_coefficient: Number.parseFloat(st.config.energy_gain_coefficient),
    expense_pool_percent: Number.parseFloat(st.config.expense_pool_percent),
  }
}

/** Требование уровня N: level_depth_base × level_growth_coefficient^(N−1), усечённое. */
export function levelRequirement(level: number, cfg: CapitalConfig): number {
  let multiplier = 1
  for (let i = 1; i < level; i++) multiplier *= cfg.level_growth_coefficient
  return Math.trunc(cfg.level_depth_base * multiplier)
}

/** Начисление энергии за вклад: (сумма / требование) × 100 × коэффициент прироста. */
export function energyGain(amountMinor: number, level: number, cfg: CapitalConfig): number {
  if (amountMinor <= 0) return 0
  return (amountMinor / levelRequirement(level, cfg)) * 100 * cfg.energy_gain_coefficient
}

/** Вклад, дающий ровно один уровень при текущей конфигурации (100 энергии). */
export function amountForOneLevel(level: number, cfg: CapitalConfig): number {
  return Math.round(levelRequirement(level, cfg) / cfg.energy_gain_coefficient)
}

/**
 * Модель начисления контракта: вклад расходуется ПОСЛЕДОВАТЕЛЬНО по уровням,
 * и требование каждого пройденного списывается по своей — уже большей —
 * величине.
 *
 * Так и устроен контракт после исправления. Прежде начисление считалось один
 * раз от требования стартового уровня, а накопленная энергия делилась на сотню
 * линейно: коэффициент роста при перескоке не применялся, и один крупный вклад
 * поднимал на кратно большее число уровней (взнос в миллион при базе 10 000 ₽
 * давал сотню уровней вместо десяти).
 *
 * Модель нужна ещё и потому, что участник стартует с ненулевой энергией:
 * сравнивать «уровень вырос на три» в лоб нельзя — накопленный остаток может
 * добросить ещё один переход.
 */
export function applyContribution(
  amountMinor: number,
  startLevel: number,
  startEnergy: number,
  cfg: CapitalConfig,
): { level: number, energy: number, levelsGained: number } {
  let level = startLevel
  let energy = startEnergy

  if (amountMinor <= 0) return { level, energy, levelsGained: 0 }

  let remaining = amountMinor * cfg.energy_gain_coefficient

  for (let steps = 0; steps < 1_000_000; steps++) {
    const requirement = levelRequirement(level, cfg)
    if (requirement <= 0) break

    const needed = (100 - energy) / 100 * requirement
    if (remaining < needed) {
      energy += remaining / requirement * 100
      return { level, energy, levelsGained: level - startLevel }
    }

    remaining -= needed
    level += 1
    energy = 0
  }

  return { level, energy, levelsGained: level - startLevel }
}

export async function getContributor(bc: any, username: string): Promise<any | undefined> {
  const rows = await bc.getTableRows(
    CapitalContract.contractName.production, COOP, 'contributors', 1, username, username, 2, 'i64',
  ) as any[]
  return rows[0]
}

export async function getUserWallet(bc: any, username: string, walletName: string) {
  const rows = await bc.getTableRows('ledger2', COOP, 'userwallets', 1000) as any[]
  const row = rows.find(r => r.username === username && r.wallet_name === walletName)
  return {
    available: amount(row?.available),
    blocked: amount(row?.blocked),
  }
}

export interface BootstrapOptions {
  /** Подписать оферту ЦПП «Благорост» (без неё нет кошелька программы). */
  capitalAgreement?: boolean
  /** Зарегистрировать договор УХД. */
  contract?: boolean
  /** Провести одобрение договора председателем (статус active вместо pending). */
  approveContract?: boolean
  /** Сколько рублей положить на паевой кошелёк. */
  deposit?: number
}

/**
 * Заводит пайщика под программные взносы. Каждый шаг отключаем отдельно —
 * боковые ветки как раз и проверяют, что происходит без него.
 *
 * `addUser` сам подписывает соглашение ЦПП «Цифровой Кошелёк» и заводит
 * кошелёк, поэтому повторно его здесь не подписываем.
 */
export async function bootstrapMember(bc: any, opts: BootstrapOptions = {}): Promise<string> {
  const {
    capitalAgreement = true,
    contract = true,
    approveContract = true,
    deposit = 1_000_000,
  } = opts

  const username = generateRandomUsername()
  await addUser(username)

  if (capitalAgreement) {
    await signCapitalAgreement(bc, COOP, username, fakeDocument)
  }

  if (contract) {
    const contributorHash = generateRandomSHA256()
    const doc = signedBy(username)
    const data: CapitalContract.Actions.RegisterContributor.IRegisterContributor = {
      coopname: COOP,
      username,
      contributor_hash: contributorHash,
      rate_per_hour: ratePerHour,
      hours_per_day: 8,
      is_external_contract: false,
      contract: doc,
      storage_agreement: doc,
      generator_agreement: doc,
      blagorost_agreement: doc,
    } as any
    await bc.api.transact({
      actions: [{
        account: CapitalContract.contractName.production,
        name: CapitalContract.Actions.RegisterContributor.actionName,
        authorization: [{ actor: COOP, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })

    // Без одобрения председателя договор остаётся в статусе ожидания — именно
    // это состояние проверяют боковые ветки послабления.
    if (approveContract) {
      await processApprove(bc, COOP, contributorHash)
    }
  }

  if (deposit > 0) {
    await depositToWallet(bc, COOP, username, deposit)
  }

  return username
}

/** Программный взнос в «Благорост». Сумма — в минорных единицах. */
export async function programInvest(bc: any, username: string, amountMinor: number) {
  return bc.api.transact({
    actions: [{
      account: CapitalContract.contractName.production,
      name: CapitalContract.Actions.CreateProgramInvest.actionName,
      authorization: [{ actor: COOP, permission: 'active' }],
      data: {
        coopname: COOP,
        username,
        invest_hash: generateRandomSHA256(),
        amount: rub(amountMinor / 10_000),
        statement: signedBy(username),
      },
    }],
  }, { blocksBehind: 3, expireSeconds: 30 })
}

/** Свободные средства программы — глобальный пул доступных инвестиций. */
export async function programFreePool(bc: any): Promise<number> {
  const rows = await bc.getTableRows(CapitalContract.contractName.production, 'capital', 'state', 10) as any[]
  const st = rows.find(r => r.coopname === COOP)
  return amount(st?.global_available_invest_pool)
}
