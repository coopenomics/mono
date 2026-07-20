/**
 * Фаза 01 — программы УХД (id=3, type='generator') и Благорост
 * (id=4, type='capital') + capital::setconfig.
 *
 * Идемпотентно: программы создаются только если их ещё нет в `programs`-таблице,
 * setconfig — только если `state` пуст.
 *
 * Параметры скопированы один-в-один из src/tests/capital.test.ts:140-288 —
 * чтобы скриншоты документации соответствовали поведению, под которое
 * настроены контрактные тесты.
 */
import { CapitalContract, SovietContract } from 'cooptypes'
import Blockchain from '../../../blockchain'
import config from '../../../configs'

const log = (...a: unknown[]) => console.error('[seed-capital:01]', ...a)

const COOPNAME = 'voskhod'
const CHAIRMAN = 'ant'

// Дублируем числа из tests/capital/consts.ts — импорт оттуда тащит цепочку
// модулей с `import { expect } from 'vitest'`, а seed-скрипт запускается
// через esno, не под vitest-раннером.
const SOURCE_PROGRAM_ID = 3
const CAPITAL_PROGRAM_ID = 4

async function getCoopProgram(blockchain: Blockchain, coopname: string, programId: number) {
  const rows = await blockchain.getTableRows(
    SovietContract.contractName.production,
    coopname,
    'programs',
    1000,
    programId.toString(),
    programId.toString(),
  )
  return rows[0]
}

export async function phase01(): Promise<void> {
  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  // --- Программа УХД (Договор УХД) ---
  const sourceProgram = await getCoopProgram(blockchain, COOPNAME, SOURCE_PROGRAM_ID)
  if (!sourceProgram) {
    log(`создаю программу УХД (id=${SOURCE_PROGRAM_ID})`)
    const data: SovietContract.Actions.Programs.CreateProgram.ICreateProgram = {
      coopname: COOPNAME,
      is_can_coop_spend_share_contributions: true,
      username: CHAIRMAN,
      title: 'Договор УХД',
      announce: '',
      description: '',
      preview: '',
      images: '',
      calculation_type: 'free',
      fixed_membership_contribution: '0.0000 RUB',
      membership_percent_fee: '0',
      meta: '',
      type: 'generator',
    }
    await blockchain.api.transact({
      actions: [{
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Programs.CreateProgram.actionName,
        authorization: [{ actor: CHAIRMAN, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
  } else {
    log(`программа УХД (id=${SOURCE_PROGRAM_ID}) уже есть — пропуск`)
  }

  // --- Программа Благорост ---
  const capitalProgram = await getCoopProgram(blockchain, COOPNAME, CAPITAL_PROGRAM_ID)
  if (!capitalProgram) {
    log(`создаю программу Благорост (id=${CAPITAL_PROGRAM_ID})`)
    const data: SovietContract.Actions.Programs.CreateProgram.ICreateProgram = {
      coopname: COOPNAME,
      is_can_coop_spend_share_contributions: false,
      username: CHAIRMAN,
      title: 'Благорост',
      announce: '',
      description: '',
      preview: '',
      images: '',
      calculation_type: 'free',
      fixed_membership_contribution: '0.0000 RUB',
      membership_percent_fee: '0',
      meta: '',
      type: 'capital',
    }
    await blockchain.api.transact({
      actions: [{
        account: SovietContract.contractName.production,
        name: SovietContract.Actions.Programs.CreateProgram.actionName,
        authorization: [{ actor: CHAIRMAN, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
  } else {
    log(`программа Благорост (id=${CAPITAL_PROGRAM_ID}) уже есть — пропуск`)
  }

  // --- capital::setconfig ---
  // Проверяем `state`-таблицу: если запись для voskhod уже есть, повторно не пушим
  // (даже несмотря на то, что setconfig сам по себе перезаписывает конфиг).
  const stateRows = await blockchain.getTableRows(
    CapitalContract.contractName.production,
    CapitalContract.contractName.production,
    'state',
    1,
    COOPNAME,
    COOPNAME,
  )
  if (!stateRows || stateRows.length === 0) {
    log('инициализирую CAPITAL config')
    const data: CapitalContract.Actions.SetConfig.ISetConfig = {
      coopname: COOPNAME,
      config: {
        coordinator_bonus_percent: 4,
        expense_pool_percent: 100,
        coordinator_invite_validity_days: 30,
        voting_period_in_days: 7,
        authors_voting_percent: 38.2,
        creators_voting_percent: 38.2,
        energy_decay_rate_per_day: 0.11,
        level_depth_base: 1000,
        level_growth_coefficient: 1.5,
        energy_gain_coefficient: 0.01,
      },
    }
    await blockchain.api.transact({
      actions: [{
        account: CapitalContract.contractName.production,
        name: CapitalContract.Actions.SetConfig.actionName,
        authorization: [{ actor: COOPNAME, permission: 'active' }],
        data,
      }],
    }, { blocksBehind: 3, expireSeconds: 30 })
  } else {
    log('CAPITAL config уже инициализирован — пропуск')
  }

  log('фаза 01 завершена')
}
