/**
 * Отказы стенда: пауза и возобновление его сервисов.
 *
 * Часть поведения узла видна только тогда, когда что-то перестало работать:
 * чтение цепи встало, узел отстал, связь вернулась. Через API такое состояние
 * не создать, поэтому наборы `src/faults` замораживают сервис стенда
 * (`docker compose pause`) и смотрят снаружи, что узел показывает пайщику.
 *
 * Рычаг включён только в фазе `faults` стенда внешнего слоя
 * (scripts/blackbox/stack.sh): на рабочем стенде пауза сервиса — отказ для
 * всех, кто с ним работает. Без `BLACKBOX_FAULTS=1` наборы пропускаются.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gql } from './client'
import { CHAIN_URL } from './env'
import { waitFor } from './wait'

const run = promisify(execFile)
const ROOT = process.env.BLACKBOX_ROOT ?? ''

/** Разрешены ли отказы на этом стенде. */
export const FAULTS_ENABLED = process.env.BLACKBOX_FAULTS === '1' && ROOT !== ''

/** Сервис стенда, который читает цепь и ведёт позицию чтения узла. */
export const CHAIN_READER = 'parser2'

/** Узел цепи стенда. */
export const CHAIN_NODE = 'node'

async function compose(...args: string[]): Promise<void> {
  if (!FAULTS_ENABLED)
    throw new Error('отказы стенда выключены: набор запускается фазой faults (BLACKBOX_FAULTS=1)')
  await run('docker', ['compose', ...args], { cwd: ROOT })
}

/** Заморозить сервис: процесс жив, но не исполняется. */
export async function pauseService(service: string): Promise<void> {
  await compose('pause', service)
}

/** Разморозить сервис; повторный вызов для работающего сервиса — не ошибка. */
export async function resumeService(service: string): Promise<void> {
  await compose('unpause', service).catch((e: any) => {
    if (!/not paused/i.test(`${e?.stderr ?? ''}${e?.message ?? ''}`))
      throw e
  })
}

/** Остановить сервис штатно: процесс завершается, адрес перестаёт отвечать. */
export async function stopService(service: string): Promise<void> {
  await compose('stop', '-t', '60', service)
}

/** Запустить остановленный сервис. */
export async function startService(service: string): Promise<void> {
  await compose('start', service)
}

/** Цепь отвечает и выпускает блоки. */
export async function awaitChainProducing(timeoutMs = 180_000): Promise<void> {
  let seen: number | null = null
  await waitFor(async () => {
    const info: any = await (await fetch(`${CHAIN_URL}/v1/chain/get_info`)).json()
    const head = Number(info.head_block_num)
    if (seen !== null && head > seen)
      return true
    seen = head
    return null
  }, { timeoutMs, intervalMs: 1_000, label: 'цепь стенда снова выпускает блоки' })
}

/** Узел у головы цепи — стенд готов к следующему набору. */
export async function awaitNodeSynced(timeoutMs = 240_000): Promise<void> {
  await waitFor(async () => {
    const d = await gql<any>(null, 'query{ getNodeSyncState{ status } }')
    return d.getNodeSyncState?.status === 'SYNCED' ? true : null
  }, { timeoutMs, intervalMs: 1_000, label: 'узел стенда у головы цепи' })
}
