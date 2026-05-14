import fetch from 'node-fetch'
import { DraftContract, RegistratorContract, SovietContract } from 'cooptypes'
import type { Database } from '../Database'
import { eosioApi } from '../config'

interface TableRow {
  code: string
  scope: string
  table: string
  primary_key: string
  value: any
  block_num: number
  present: boolean
}

/**
 * Функция получения данных из таблицы блокчейна
 */
async function getTableRows(
  code: string,
  scope: string,
  table: string,
  limit = 1000,
): Promise<any[]> {
  const response = await fetch(`${eosioApi}/v1/chain/get_table_rows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      json: true,
      code,
      scope,
      table,
      limit,
    }),
  })

  const result = await response.json() as any
  return result.rows || []
}

/**
 * Проверка наличия данных кооператива в базе данных
 */
async function checkCooperativeExists(db: Database, coopname: string): Promise<boolean> {
  try {
    const cooperative = await db.getDelta({
      'code': RegistratorContract.contractName.production,
      'scope': RegistratorContract.contractName.production,
      'table': RegistratorContract.Tables.Cooperatives.tableName,
      'value.username': coopname,
    })

    return !!cooperative
  }
  catch (error) {
    console.error('Ошибка проверки наличия данных кооператива:', error)
    return false
  }
}

/**
 * Проверка наличия шаблонов документов в базе данных
 */
async function checkTemplatesExist(db: Database): Promise<boolean> {
  try {
    const drafts = await db.getDelta({
      code: DraftContract.contractName.production,
      scope: DraftContract.contractName.production,
      table: DraftContract.Tables.Drafts.tableName,
    })

    return !!drafts
  }
  catch (error) {
    console.error('Ошибка проверки наличия шаблонов:', error)
    return false
  }
}

/**
 * Загрузка данных кооператива из блокчейна в базу данных
 */
async function loadCooperativeFromBlockchain(
  db: Database,
  coopname: string,
  block_num: number,
): Promise<void> {
  console.log(`Загрузка данных кооператива ${coopname} из блокчейна...`)

  // Загружаем данные о кооперативе из таблицы cooperatives
  const cooperatives = await getTableRows(RegistratorContract.contractName.production, RegistratorContract.contractName.production, RegistratorContract.Tables.Cooperatives.tableName)
  const cooperative = cooperatives.find((row: any) => row.username === coopname)

  if (!cooperative) {
    throw new Error(`Кооператив ${coopname} не найден в блокчейне`)
  }

  // Сохраняем данные о кооперативе как дельту
  const cooperativeDelta: TableRow = {
    code: RegistratorContract.contractName.production,
    scope: RegistratorContract.contractName.production,
    table: RegistratorContract.Tables.Cooperatives.tableName,
    primary_key: cooperative.username, // username - это primary_key для cooperatives
    value: cooperative,
    block_num,
    present: true,
  }

  await db.saveDeltaToDB(cooperativeDelta)
  console.log(`✓ Данные кооператива ${coopname} загружены`)

  // Загружаем данные о совете кооператива (опционально)
  const boards = await getTableRows(SovietContract.contractName.production, coopname, SovietContract.Tables.Boards.tableName)
  const soviet = boards.find((row: any) => row.type === 'soviet')

  if (soviet) {
    // Сохраняем данные о совете как дельту
    const sovietDelta: TableRow = {
      code: SovietContract.contractName.production,
      scope: coopname,
      table: SovietContract.Tables.Boards.tableName,
      primary_key: String(soviet.id), // id - это primary_key для boards
      value: {
        ...soviet,
        id: String(soviet.id),
      },
      block_num,
      present: true,
    }

    await db.saveDeltaToDB(sovietDelta)
    console.log(`✓ Данные совета кооператива ${coopname} загружены`)
  }
  else {
    console.log(`⚠ Совет кооператива ${coopname} не найден в блокчейне, продолжаем инициализацию`)
  }
}

/**
 * Загрузка всех шаблонов документов из блокчейна в базу данных
 */
async function loadTemplatesFromBlockchain(
  db: Database,
  block_num: number,
): Promise<void> {
  console.log('Загрузка шаблонов документов из блокчейна...')

  // Загружаем все шаблоны из таблицы drafts
  const drafts = await getTableRows(DraftContract.contractName.production, DraftContract.contractName.production, DraftContract.Tables.Drafts.tableName)

  if (drafts.length === 0) {
    console.log('⚠ Шаблоны документов не найдены в блокчейне')
    return
  }

  // Сохраняем каждый шаблон как дельту
  for (const draft of drafts) {
    const draftDelta: TableRow = {
      code: DraftContract.contractName.production,
      scope: DraftContract.contractName.production,
      table: DraftContract.Tables.Drafts.tableName,
      primary_key: String(draft.registry_id), // registry_id - это primary_key для drafts
      value: {
        ...draft,
        registry_id: String(draft.registry_id),
        version: String(draft.version),
        default_translation_id: String(draft.default_translation_id),
      },
      block_num,
      present: true,
    }

    await db.saveDeltaToDB(draftDelta)
  }

  console.log(`✓ Загружено ${drafts.length} шаблонов документов`)

  // Загружаем все переводы шаблонов из таблицы translations
  const translations = await getTableRows('draft', 'draft', 'translations')

  if (translations.length === 0) {
    console.log('⚠ Переводы шаблонов не найдены в блокчейне')
    return
  }

  // Сохраняем каждый перевод как дельту
  for (const translation of translations) {
    const translationDelta: TableRow = {
      code: DraftContract.contractName.production,
      scope: DraftContract.contractName.production,
      table: DraftContract.Tables.Translations.tableName,
      primary_key: String(translation.id), // id - это primary_key для translations
      value: {
        ...translation,
        id: String(translation.id),
        draft_id: String(translation.draft_id),
      },
      block_num,
      present: true,
    }

    await db.saveDeltaToDB(translationDelta)
  }

  console.log(`✓ Загружено ${translations.length} переводов шаблонов`)
}

/**
 * Главная функция инициализации
 * Вызывается при запуске парсера с блока head (текущего) когда START_BLOCK=1
 * Проверяет наличие необходимых данных и загружает их из блокчейна если их нет.
 *
 * @param block_num — block_num, который Reader будет использовать как стартовый
 *   (`currentBlock`). Initializer пишет дельты с этим же значением, чтобы
 *   последующий `purgeAfterBlock(currentBlock)` (использует $gt, не $gte)
 *   не стирал записи Initializer'а, если head успел шагнуть с момента
 *   запроса в Reader.
 */
export async function initializeFromBlockchain(db: Database, block_num: number): Promise<void> {
  const coopname = process.env.COOPNAME

  if (!coopname) {
    console.log('⚠ COOPNAME не указан в .env, пропускаем инициализацию')
    return
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Проверка необходимости инициализации данных')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const currentBlock = block_num

  // Проверяем наличие данных кооператива
  const cooperativeExists = await checkCooperativeExists(db, coopname)
  const templatesExist = await checkTemplatesExist(db)

  if (cooperativeExists && templatesExist) {
    console.log('✓ Данные кооператива и шаблоны уже существуют в базе')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return
  }

  console.log(`Начинаем инициализацию из блокчейна (блок ${currentBlock})...`)

  // Загружаем данные кооператива если их нет
  if (!cooperativeExists) {
    await loadCooperativeFromBlockchain(db, coopname, currentBlock)
  }
  else {
    console.log(`✓ Данные кооператива ${coopname} уже существуют`)
  }

  // Загружаем шаблоны если их нет
  if (!templatesExist) {
    await loadTemplatesFromBlockchain(db, currentBlock)
  }
  else {
    console.log('✓ Шаблоны документов уже существуют')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✓ Инициализация завершена успешно')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}
