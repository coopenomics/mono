import { initDadataInPostgres, initExtensionsInPostgres, initSystemStatus } from '../postgres-init'
import { installExtraData, installInitialData, startInfra } from './infra'
import { startCoop } from './cooperative'
import { installRobotPreset } from './robot-preset'

export async function boot() {
  const blockchain = await startInfra()
  await installInitialData(blockchain, false) // Создать базовый совет

  console.log('Инициализируем статус системы в PostgreSQL')
  await initSystemStatus()
  await initDadataInPostgres()

  await startCoop()
}

export async function bootClean() {
  // Только инфраструктура: контракты, фичи, токен, системные параметры.
  // Ни совета, ни программ — программы (createPrograms) требуют существующий
  // совет и создаются в boot/bootExtra внутри installInitialData. В clean их
  // не делаем (иначе soviet::createprog падает с «Совет не найден»).
  await startInfra()
}

export async function bootExtra() {
  const blockchain = await startInfra()
  await installInitialData(blockchain, true) // Создать расширенный совет (устанавливает статус 'active' в MongoDB)

  // installExtraData регистрирует partner1 как coop с auto-approve от провайдера —
  // это и есть программная on-chain активация, которая триггерит аренду VM в
  // провайдере (PENDING→RENT). boot:extra используется НЕ только для аренды
  // сервера (например, просто пересев совета/чейна для других задач), поэтому
  // провижининг partner1 включается ТОЛЬКО под флагом EXTRA_RENT=1.
  //
  // EXTRA_SEED=1 (взаимоисключающее с EXTRA_RENT) — сидит partner1 как
  // пайщика-organization Восхода (newaccount + reguser + wallet-signagree +
  // засев coopback) БЕЗ regcoop+preInit. Pre-state для ручного прохода
  // ConnectionAgreement: signin под WIF из фикстуры → UI выбора тарифа /
  // подписания / активации руками. EXTRA_RENT приоритетен.
  if (process.env.EXTRA_RENT === '1') {
    console.log('EXTRA_RENT=1 → installExtraData: провижининг partner1 (триггер аренды)')
    await installExtraData(blockchain, 'full')
  }
  else if (process.env.EXTRA_SEED === '1') {
    console.log('EXTRA_SEED=1 → installExtraData (candidate): partner1 — пайщик-organization, готов к UI Connect')
    await installExtraData(blockchain, 'candidate')
  }
  else {
    console.log('EXTRA_RENT/EXTRA_SEED не заданы → пропускаем провижининг partner1')
  }

  console.log('Инициализируем статус системы в PostgreSQL')
  await initSystemStatus() // Устанавливает статус 'active' в PostgreSQL

  console.log('Инициализируем extensions в PostgreSQL')
  await initExtensionsInPostgres() // Инициализирует таблицу extensions с данными capital

  // Совет из пяти человек означает пять входов в кабинет на каждое решение.
  // Робот снимает это со стенда целиком: приём пайщика, выдача имущества и
  // отмена сделки по гарантийному возврату проходят без людей — весь совет
  // вместе с председателем голосует сразу, протоколы подписывает робот.
  // Разрешения, ключи и само расширение готовятся здесь: стенд считает решения
  // сам. В обычной загрузке расширения нет — председатель ставит его из каталога.
  console.log('Предустанавливаем робота решений совета')
  await installRobotPreset(blockchain)
}
