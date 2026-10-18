/**
 * Счётчик оперативной памяти цепи по этапам процесса.
 *
 * Процессы платформы проводит контроллер: тест зовёт GraphQL, а транзакции
 * подписывает и отправляет бэкенд — трасс транзакций с `account_ram_deltas`
 * у теста нет. Поэтому память меряется снимками состояния цепи:
 *
 *   • `ram_usage` каждого аккаунта цепи — точные байты, которые цепь списала
 *     с аккаунта. Список аккаунтов — скоупы таблицы `eosio::userres`: запись
 *     о ресурсах есть у каждого аккаунта;
 *   • число строк каждой таблицы каждого контракта (`get_table_by_scope`) —
 *     что именно лежит в памяти: какая таблица в каком скоупе выросла.
 *
 * После шага цепь ещё дописывает хвосты: колбэки совета, слушатели
 * контроллера, повторы. Снимок этапа берётся, когда сумма памяти не меняется
 * два опроса подряд (`settle`).
 *
 * Байты этапа — нарастающий итог от снимка «до процесса»: столько памяти
 * процесс удерживает, пока ждёт следующего шага. Пик — максимум этого итога,
 * остаток после закрытия — память, которую процесс оставляет навсегда.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { CHAIN_URL } from '../marketplace/chainHelpers'

const EPOCH = '1970-01-01T00:00:00.000'

/** Снимок памяти цепи. */
export interface RamSnapshot {
  at: string
  /** `ram_usage` по аккаунтам, байт. */
  accounts: Record<string, number>
  /** Число строк по ключу `контракт/таблица/скоуп`. */
  rows: Record<string, number>
  total: number
}

/** Этап процесса: что сделано и чего процесс ждёт дальше. */
export interface RamStage {
  key: string
  title: string
  awaits: string
  snapshot: RamSnapshot
}

async function chainPost<T = any>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${CHAIN_URL}/v1/chain/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok)
    throw new Error(`${endpoint}: HTTP ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

/** Все строки `get_table_by_scope` по контракту (и таблице, если задана). */
async function tablesByScope(code: string, table?: string): Promise<{ code: string, scope: string, table: string, count: number }[]> {
  const out: { code: string, scope: string, table: string, count: number }[] = []
  let lower = ''
  for (;;) {
    const d: any = await chainPost('get_table_by_scope', { code, table, lower_bound: lower, limit: 1000 })
    out.push(...(d.rows ?? []))
    if (!d.more)
      break
    lower = d.more
  }
  return out
}

/** Параллельный обход с ограничением числа одновременных запросов к узлу. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = Array.from({ length: items.length })
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k])
    }
  }))
  return out
}

export class RamMeter {
  private contracts: string[] = []
  readonly stages: RamStage[] = []
  /** Изменения памяти без действий процесса — шум стенда (кроны контроллера). */
  idleDrift: Record<string, number> = {}

  /** Аккаунты цепи — скоупы `eosio::userres`. */
  private async listAccounts(): Promise<string[]> {
    return (await tablesByScope('eosio', 'userres')).map(r => r.scope)
  }

  async snapshot(): Promise<RamSnapshot> {
    const names = await this.listAccounts()
    const infos = await mapLimit(names, 16, n => chainPost('get_account', { account_name: n }))
    const accounts: Record<string, number> = {}
    const withCode: string[] = []
    infos.forEach((a: any, k) => {
      accounts[names[k]] = Number(a.ram_usage)
      if (a.last_code_update && a.last_code_update !== EPOCH)
        withCode.push(names[k])
    })
    // Контракты запоминаются один раз и дополняются: контракт, развёрнутый по
    // ходу процесса, тоже попадёт в разбор таблиц.
    this.contracts = [...new Set([...this.contracts, ...withCode])].sort()
    const rows: Record<string, number> = {}
    const lists = await mapLimit(this.contracts, 8, c => tablesByScope(c))
    for (const list of lists) {
      for (const r of list)
        rows[`${r.code}/${r.table}/${r.scope}`] = Number(r.count)
    }
    const total = Object.values(accounts).reduce((s, v) => s + v, 0)
    return { at: new Date().toISOString(), accounts, rows, total }
  }

  /**
   * Снимок после затишья: память не меняется два опроса подряд. Хвосты шага
   * (колбэки, слушатели контроллера) успевают лечь в цепь.
   */
  async settle(quietMs = 4_000, timeoutMs = 90_000): Promise<RamSnapshot> {
    const deadline = Date.now() + timeoutMs
    let prev = await this.snapshot()
    let stable = 0
    while (Date.now() < deadline) {
      // timing: backoff — ждём, пока хвосты шага (колбэки, слушатели) лягут в цепь
      await new Promise(r => setTimeout(r, quietMs))
      const next = await this.snapshot()
      const same = next.total === prev.total && sameRows(next.rows, prev.rows)
      prev = next
      if (same && ++stable >= 2)
        return next
      if (!same)
        stable = 0
    }
    console.warn(`[ram-cost] память не успокоилась за ${timeoutMs / 1000} с — снимок как есть`)
    return prev
  }

  /** Шум стенда: два снимка с паузой без действий процесса. */
  async measureIdle(pauseMs = 30_000): Promise<void> {
    const a = await this.snapshot()
    // timing: timeout — окно без действий процесса: дрейф за него и есть шум стенда
    await new Promise(r => setTimeout(r, pauseMs))
    const b = await this.snapshot()
    this.idleDrift = diffMap(a.accounts, b.accounts)
  }

  async stage(key: string, title: string, awaits: string): Promise<RamStage> {
    const snapshot = await this.settle()
    const s = { key, title, awaits, snapshot }
    this.stages.push(s)
    const base = this.stages[0].snapshot.total
    const prev = this.stages.length > 1 ? this.stages[this.stages.length - 2].snapshot.total : base
    console.log(`[ram-cost] ${key}: удерживается ${fmt(snapshot.total - base)} (шаг ${fmt(snapshot.total - prev)}) — ${title}`)
    return s
  }
}

function sameRows(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if ((a[k] ?? 0) !== (b[k] ?? 0))
      return false
  }
  return true
}

/** Ненулевые разницы `b − a` по ключам. */
export function diffMap(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = (b[k] ?? 0) - (a[k] ?? 0)
    if (d !== 0)
      out[k] = d
  }
  return out
}

export function fmt(bytes: number): string {
  const sign = bytes < 0 ? '−' : ''
  const v = Math.abs(bytes)
  return v >= 1024 ? `${sign}${(v / 1024).toFixed(2)} КБ (${sign}${v} Б)` : `${sign}${v} Б`
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'
}

function listDiff(d: Record<string, number>): string {
  const items = Object.entries(d).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
  return items.length ? items.map(([k, v]) => `${k} ${signed(v)}`).join('<br>') : '—'
}

/** Длительности этапов для расчёта байт·суток: ключ этапа → сутки. */
export type StageDays = Record<string, number>

export interface RamReport {
  process: string
  generated_at: string
  idle_drift: Record<string, number>
  stages: {
    key: string
    title: string
    awaits: string
    held_bytes: number
    step_bytes: number
    accounts_held: Record<string, number>
    accounts_step: Record<string, number>
    rows_held: Record<string, number>
    rows_step: Record<string, number>
    days: number
    byte_days: number
  }[]
  peak: { stage: string, bytes: number, accounts: Record<string, number> }
  residual: { bytes: number, accounts: Record<string, number>, rows: Record<string, number> }
  byte_days_total: number
  days_total: number
  avg_bytes_per_day: number
}

/**
 * Отчёт: удерживаемая память по этапам, пик, остаток навсегда, байт·сутки
 * при заданных длительностях этапов.
 */
export function buildReport(processName: string, meter: RamMeter, days: StageDays): RamReport {
  const [base, ...rest] = meter.stages
  const b = base.snapshot
  const stages = rest.map((s, k) => {
    const prev = k === 0 ? b : rest[k - 1].snapshot
    const held = s.snapshot.total - b.total
    const d = days[s.key] ?? 0
    return {
      key: s.key,
      title: s.title,
      awaits: s.awaits,
      held_bytes: held,
      step_bytes: s.snapshot.total - prev.total,
      accounts_held: diffMap(b.accounts, s.snapshot.accounts),
      accounts_step: diffMap(prev.accounts, s.snapshot.accounts),
      rows_held: diffMap(b.rows, s.snapshot.rows),
      rows_step: diffMap(prev.rows, s.snapshot.rows),
      days: d,
      byte_days: held * d,
    }
  })
  const peakStage = stages.reduce((m, s) => (s.held_bytes > m.held_bytes ? s : m), stages[0])
  const last = stages[stages.length - 1]
  const byteDays = stages.reduce((sum, s) => sum + s.byte_days, 0)
  const daysTotal = stages.reduce((sum, s) => sum + s.days, 0)
  return {
    process: processName,
    generated_at: new Date().toISOString(),
    idle_drift: meter.idleDrift,
    stages,
    peak: { stage: peakStage.key, bytes: peakStage.held_bytes, accounts: peakStage.accounts_held },
    residual: { bytes: last.held_bytes, accounts: last.accounts_held, rows: last.rows_held },
    byte_days_total: byteDays,
    days_total: daysTotal,
    avg_bytes_per_day: daysTotal ? Math.round(byteDays / daysTotal) : 0,
  }
}

export function renderMarkdown(r: RamReport): string {
  const out: string[] = []
  out.push(`# Оперативная память цепи: ${r.process}`, '')
  out.push(`Снято ${r.generated_at}. Байты — \`ram_usage\` аккаунтов цепи, нарастающим итогом от снимка «до процесса».`, '')
  out.push(`**Пик:** ${fmt(r.peak.bytes)} на этапе «${r.stages.find(s => s.key === r.peak.stage)?.title}».`, '')
  out.push(`**Остаётся навсегда после закрытия:** ${fmt(r.residual.bytes)}.`, '')
  out.push(`**Байт·сутки за процесс:** ${r.byte_days_total} при длительности ${r.days_total} сут; в среднем ${fmt(r.avg_bytes_per_day)} в сутки.`, '')
  const drift = Object.keys(r.idle_drift).length
  out.push(drift
    ? `> ⚠️ Шум стенда: за 30 с без действий процесса память изменилась у ${drift} аккаунтов: ${listDiff(r.idle_drift).replaceAll('<br>', ', ')}.`
    : '> Шум стенда: за 30 с без действий процесса память не изменилась.', '')
  out.push('## Этапы', '')
  out.push('| # | этап | процесс ждёт | удерживается | шаг | сутки | байт·сутки |')
  out.push('|---|---|---|---|---|---|---|')
  r.stages.forEach((s, k) => {
    out.push(`| ${k + 1} | ${s.title} | ${s.awaits} | ${fmt(s.held_bytes)} | ${fmt(s.step_bytes)} | ${s.days} | ${s.byte_days} |`)
  })
  out.push('', '## Кто держит память на каждом этапе', '')
  out.push('| этап | аккаунты (байт от начала) | строки таблиц (от начала) |')
  out.push('|---|---|---|')
  for (const s of r.stages)
    out.push(`| ${s.title} | ${listDiff(s.accounts_held)} | ${listDiff(s.rows_held)} |`)
  out.push('', '## Что меняет каждый шаг', '')
  out.push('| шаг | аккаунты (байт) | строки таблиц |')
  out.push('|---|---|---|')
  for (const s of r.stages)
    out.push(`| ${s.title} | ${listDiff(s.accounts_step)} | ${listDiff(s.rows_step)} |`)
  out.push('')
  return out.join('\n')
}

/** Пишет отчёт в каталог `RAM_COST_OUT` (JSON и Markdown). */
export function writeReport(r: RamReport, slug: string): string | null {
  const dir = process.env.RAM_COST_OUT
  if (!dir)
    return null
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${slug}.json`), JSON.stringify(r, null, 2))
  const md = path.join(dir, `${slug}.md`)
  fs.writeFileSync(md, renderMarkdown(r))
  return md
}
