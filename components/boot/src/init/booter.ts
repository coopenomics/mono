import { initExtensionsInPostgres, initSystemStatus } from '../postgres-init'
import { installExtraData, installInitialData, startInfra } from './infra'
import { startCoop } from './cooperative'

export async function boot() {
  const blockchain = await startInfra()
  await installInitialData(blockchain, false) // Создать базовый совет

  console.log('Инициализируем статус системы в PostgreSQL')
  await initSystemStatus()

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
  if (process.env.EXTRA_RENT === '1') {
    console.log('EXTRA_RENT=1 → installExtraData: провижининг partner1 (триггер аренды)')
    await installExtraData(blockchain) // Регистрируем partner1 как coop (active)
  }
  else {
    console.log('EXTRA_RENT не задан → пропускаем провижининг partner1 (аренда не запускается)')
  }

  console.log('Инициализируем статус системы в PostgreSQL')
  await initSystemStatus() // Устанавливает статус 'active' в PostgreSQL

  console.log('Инициализируем extensions в PostgreSQL')
  await initExtensionsInPostgres() // Инициализирует таблицу extensions с данными capital
}
