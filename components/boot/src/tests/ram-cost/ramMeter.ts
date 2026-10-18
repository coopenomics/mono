/**
 * Счётчик оперативной памяти цепи по этапам процесса.
 *
 * Процессы платформы проводит контроллер: тест зовёт GraphQL, а транзакции
 * подписывает и отправляет бэкенд — трасс транзакций с `account_ram_deltas`
 * у теста нет. Поэтому память меряется снимками состояния цепи:
 *
 *   • `ram_usage` каждого аккаунта цепи — точные байты, которые цепь списала
 *     с аккаунта. Общего списка аккаунтов у узла нет; он собирается из
 *     системных аккаунтов boot, реестра пайщиков и кооперативов
 *     (`registrator::accounts`, `registrator::coops`), скоупов `eosio::userres`
 *     и плательщиков, найденных в таблицах контрактов. Таблица `userres` одна
 *     не годится: она есть только у аккаунтов, купивших ресурсы напрямую;
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
 *
 * Главное в отчёте — память, которую оплачивает кооператив: `ram_usage` его
 * аккаунта (точные байты) и строки таблиц, где плательщик — кооператив
 * (`show_payer`). Память контрактов и людей идёт второй частью — полная
 * картина процесса.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import config from '../../configs'
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
  /** Строки, оплаченные кооперативом, по ключу `контракт/таблица/скоуп`. */
  payerRows: Record<string, number>
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
async function tablesByScope(code: string, table?: string): Promise<{ code: string, scope: string, table: string, payer: string, count: number }[]> {
  const out: { code: string, scope: string, table: string, payer: string, count: number }[] = []
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

/** Все строки таблицы в JSON (постранично по `next_key`). */
async function allRows(code: string, scope: string, table: string): Promise<any[]> {
  const out: any[] = []
  let lower = ''
  for (;;) {
    const d: any = await chainPost('get_table_rows', { json: true, code, scope, table, lower_bound: lower, limit: 1000 })
    out.push(...(d.rows ?? []))
    if (!d.more || !d.next_key)
      break
    lower = d.next_key
  }
  return out
}

/** Системные аккаунты цепи, которые boot заводит сам. */
const SYSTEM_ACCOUNTS = ['eosio', 'eosio.ram', 'eosio.ramfee', 'eosio.stake', 'eosio.names', ...config.accounts.map(a => a.name)]

/** Число строк таблицы, за которые платит `payer` (`show_payer`). */
async function rowsPaidBy(key: string, payer: string): Promise<number> {
  const [code, table, scope] = key.split('/')
  let count = 0
  let lower = ''
  for (;;) {
    let d: any
    try {
      d = await chainPost('get_table_rows', { json: false, code, table, scope, lower_bound: lower, limit: 1000, show_payer: true })
    }
    catch (e: any) {
      // Таблица без описания в ABI узлом не читается — её строки кооператива не видны.
      console.warn(`[ram-cost] ${key}: плательщиков не прочитать — ${e?.message ?? e}`)
      return count
    }
    for (const r of d.rows ?? []) {
      if (r.payer === payer)
        count++
    }
    if (!d.more || !d.next_key)
      break
    lower = d.next_key
  }
  return count
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
  /** Аккаунты, найденные прошлыми снимками (плательщики строк и др.). */
  private known = new Set<string>(SYSTEM_ACCOUNTS)
  /** Таблицы, где число строк менялось по ходу процесса: их плательщиков пересчитываем на каждом этапе. */
  private tracked = new Set<string>()
  readonly stages: RamStage[] = []

  /** @param payer аккаунт, чью память считаем главной, — кооператив. */
  constructor(readonly payer: string) {}
  /** Изменения памяти без действий процесса — шум стенда (кроны контроллера). */
  idleDrift: Record<string, number> = {}

  /** Аккаунты цепи: известные, реестр пайщиков и кооперативов, скоупы `eosio::userres`. */
  private async listAccounts(): Promise<string[]> {
    for (const r of await tablesByScope('eosio', 'userres'))
      this.known.add(r.scope)
    for (const table of ['accounts', 'coops']) {
      for (const row of await allRows('registrator', 'registrator', table))
        this.known.add(row.username)
    }
    return [...this.known].sort()
  }

  async snapshot(): Promise<RamSnapshot> {
    const names = await this.listAccounts()
    // Имя из конфига boot может не существовать в этой сети — такой аккаунт пропускаем.
    const infos = await mapLimit(names, 16, n => chainPost('get_account', { account_name: n }).catch(() => null))
    const accounts: Record<string, number> = {}
    const withCode: string[] = []
    infos.forEach((a: any, k) => {
      if (!a)
        return
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
      for (const r of list) {
        rows[`${r.code}/${r.table}/${r.scope}`] = Number(r.count)
        // Плательщик таблицы — тоже аккаунт с памятью; со следующего снимка он в списке.
        this.known.add(r.payer)
      }
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

  /**
   * Строки кооператива: на снимке «до процесса» — по всем таблицам, дальше —
   * по таблицам, где число строк менялось хоть раз. Строки, сменившие
   * плательщика без смены числа строк, так не видны; байты кооператива
   * (`ram_usage`) их всё равно учитывают.
   */
  private async scanPayerRows(snapshot: RamSnapshot): Promise<Record<string, number>> {
    const base = this.stages[0]?.snapshot
    if (base) {
      for (const k of Object.keys(diffMap(base.rows, snapshot.rows)))
        this.tracked.add(k)
    }
    const keys = base ? [...this.tracked].filter(k => k in snapshot.rows) : Object.keys(snapshot.rows)
    const counts = await mapLimit(keys, 8, k => rowsPaidBy(k, this.payer))
    const out: Record<string, number> = {}
    keys.forEach((k, i) => {
      out[k] = counts[i]
    })
    return out
  }

  async stage(key: string, title: string, awaits: string): Promise<RamStage> {
    const snapshot = await this.settle()
    const payerRows = await this.scanPayerRows(snapshot)
    const s = { key, title, awaits, snapshot, payerRows }
    this.stages.push(s)
    const b = this.stages[0].snapshot
    const p = this.stages.length > 1 ? this.stages[this.stages.length - 2].snapshot : b
    const coop = (x: RamSnapshot) => x.accounts[this.payer] ?? 0
    console.log(`[ram-cost] ${key}: кооператив ${fmt(coop(snapshot) - coop(b))} (шаг ${fmt(coop(snapshot) - coop(p))}), всего ${fmt(snapshot.total - b.total)} — ${title}`)
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

/** Итог по одному кругу плательщиков: кооператив или все аккаунты цепи. */
export interface RamTotals {
  peak: { stage: string, bytes: number }
  residual_bytes: number
  byte_days: number
  avg_bytes_per_day: number
}

export interface RamReport {
  process: string
  payer: string
  generated_at: string
  idle_drift: Record<string, number>
  days_total: number
  stages: {
    key: string
    title: string
    awaits: string
    days: number
    /** Память кооператива: байты от начала и за шаг, строки с плательщиком-кооперативом от начала. */
    payer_held_bytes: number
    payer_step_bytes: number
    payer_rows_held: Record<string, number>
    payer_byte_days: number
    /** Полная картина: все аккаунты цепи. */
    held_bytes: number
    step_bytes: number
    accounts_held: Record<string, number>
    accounts_step: Record<string, number>
    rows_held: Record<string, number>
    rows_step: Record<string, number>
    byte_days: number
  }[]
  payer_totals: RamTotals
  totals: RamTotals
}

function totalsOf(stages: { key: string, days: number }[], held: (k: number) => number, daysTotal: number): RamTotals {
  let peak = { stage: stages[0].key, bytes: held(0) }
  let byteDays = 0
  stages.forEach((s, k) => {
    if (held(k) > peak.bytes)
      peak = { stage: s.key, bytes: held(k) }
    byteDays += held(k) * s.days
  })
  return {
    peak,
    residual_bytes: held(stages.length - 1),
    byte_days: byteDays,
    avg_bytes_per_day: daysTotal ? Math.round(byteDays / daysTotal) : 0,
  }
}

/**
 * Отчёт: память кооператива и полная картина по этапам, пик, остаток
 * навсегда, байт·сутки при заданных длительностях этапов.
 */
export function buildReport(processName: string, meter: RamMeter, days: StageDays): RamReport {
  const [base, ...rest] = meter.stages
  const b = base.snapshot
  const coop = (x: RamSnapshot) => x.accounts[meter.payer] ?? 0
  const stages = rest.map((s, k) => {
    const prev = k === 0 ? b : rest[k - 1].snapshot
    const held = s.snapshot.total - b.total
    const payerHeld = coop(s.snapshot) - coop(b)
    const d = days[s.key] ?? 0
    return {
      key: s.key,
      title: s.title,
      awaits: s.awaits,
      days: d,
      payer_held_bytes: payerHeld,
      payer_step_bytes: coop(s.snapshot) - coop(prev),
      payer_rows_held: diffMap(pick(base.payerRows, Object.keys(s.payerRows)), s.payerRows),
      payer_byte_days: payerHeld * d,
      held_bytes: held,
      step_bytes: s.snapshot.total - prev.total,
      accounts_held: diffMap(b.accounts, s.snapshot.accounts),
      accounts_step: diffMap(prev.accounts, s.snapshot.accounts),
      rows_held: diffMap(b.rows, s.snapshot.rows),
      rows_step: diffMap(prev.rows, s.snapshot.rows),
      byte_days: held * d,
    }
  })
  const daysTotal = stages.reduce((sum, s) => sum + s.days, 0)
  return {
    process: processName,
    payer: meter.payer,
    generated_at: new Date().toISOString(),
    idle_drift: meter.idleDrift,
    days_total: daysTotal,
    stages,
    payer_totals: totalsOf(stages, k => stages[k].payer_held_bytes, daysTotal),
    totals: totalsOf(stages, k => stages[k].held_bytes, daysTotal),
  }
}

function pick(m: Record<string, number>, keys: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k of keys)
    out[k] = m[k] ?? 0
  return out
}

function totalsLines(r: RamReport, t: RamTotals): string[] {
  const title = r.stages.find(s => s.key === t.peak.stage)?.title
  return [
    `- **Пик:** ${fmt(t.peak.bytes)} — этап «${title}».`,
    `- **Остаётся навсегда после закрытия:** ${fmt(t.residual_bytes)}.`,
    `- **Байт·сутки за процесс:** ${t.byte_days} при длительности ${r.days_total} сут; в среднем ${fmt(t.avg_bytes_per_day)} в сутки.`,
    '',
  ]
}

export function renderMarkdown(r: RamReport): string {
  const out: string[] = []
  out.push(`# Оперативная память цепи: ${r.process}`, '')
  out.push(`Снято ${r.generated_at}. Байты — \`ram_usage\` аккаунтов цепи, нарастающим итогом от снимка «до процесса». Сутки этапов — допущения теста, не замер.`, '')
  const drift = Object.keys(r.idle_drift).length
  out.push(drift
    ? `> ⚠️ Шум стенда: за 30 с без действий процесса память изменилась у ${drift} аккаунтов: ${listDiff(r.idle_drift).replaceAll('<br>', ', ')}.`
    : '> Шум стенда: за 30 с без действий процесса память не изменилась.', '')

  out.push(`## Платит кооператив (${r.payer})`, '')
  out.push(...totalsLines(r, r.payer_totals))
  out.push('| # | этап | процесс ждёт | держит кооператив | шаг | сутки | байт·сутки | строки кооператива (от начала) |')
  out.push('|---|---|---|---|---|---|---|---|')
  r.stages.forEach((s, k) => {
    out.push(`| ${k + 1} | ${s.title} | ${s.awaits} | ${fmt(s.payer_held_bytes)} | ${fmt(s.payer_step_bytes)} | ${s.days} | ${s.payer_byte_days} | ${listDiff(s.payer_rows_held)} |`)
  })

  out.push('', '## Полная картина: все плательщики', '')
  out.push(...totalsLines(r, r.totals))
  out.push('| # | этап | держит цепь | шаг | сутки | байт·сутки | аккаунты (байт от начала) | строки таблиц (от начала) |')
  out.push('|---|---|---|---|---|---|---|---|')
  r.stages.forEach((s, k) => {
    out.push(`| ${k + 1} | ${s.title} | ${fmt(s.held_bytes)} | ${fmt(s.step_bytes)} | ${s.days} | ${s.byte_days} | ${listDiff(s.accounts_held)} | ${listDiff(s.rows_held)} |`)
  })
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
