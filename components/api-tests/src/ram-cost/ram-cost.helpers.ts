/**
 * Замер оперативной памяти цепи в типовых процессах — общая часть наборов
 * api-tests (workflow ram-cost.yaml).
 *
 * Сам измеритель живёт в boot (components/boot/src/tests/ram-cost/ramMeter.ts)
 * и подключается относительным путём: он зависит только от node и cooptypes.
 * Цену памяти замеряет набор boot арендой `powerup` на 1 AXON и оставляет в
 * `price.json` каталога отчётов — наборы api-tests идут после него.
 *
 * Набор описывает этапы процесса таблицей «ключ → что сделано, чего ждём» и
 * длительности этапов в сутках (допущения для байт·суток), а после каждого
 * шага зовёт `mark(ключ)`. Отчёт пишется даже при падении посередине.
 */
import process from 'node:process'
import { COOP } from '../core/env'
import { RamMeter, type StageDays, axon, buildReport, fmt, readPrice, writeReport } from '../../../boot/src/tests/ram-cost/ramMeter'

export interface StageInfo { title: string, awaits: string }

/** Набор работает только в прогоне замера: в общем прогоне внешнего слоя его нет. */
export const RAM_COST_ON = Boolean(process.env.RAM_COST_OUT)

export class ProcessMeter {
  readonly meter = new RamMeter(COOP)

  constructor(
    readonly slug: string,
    readonly title: string,
    readonly stages: Record<string, StageInfo>,
    readonly days: StageDays,
  ) {}

  /** Шум стенда и снимок «до процесса» — после всего, что пишет в цепь вне процесса. */
  async start(): Promise<void> {
    await this.meter.measureIdle()
    await this.meter.stage('before', 'До процесса', 'начала процесса')
  }

  async mark(key: string): Promise<void> {
    const s = this.stages[key]
    if (!s)
      throw new Error(`этап ${key} не описан в таблице этапов процесса ${this.slug}`)
    await this.meter.stage(key, s.title, s.awaits)
  }

  /** Ключи пройденных этапов — для проверки, что процесс дошёл до конца. */
  passed(): string[] {
    return this.meter.stages.map(s => s.key)
  }

  /** Отчёт процесса с ценой из `price.json`; `RAM_COST_DAYS_<SLUG>` переопределяет сутки. */
  finish(): void {
    if (this.meter.stages.length < 2)
      return
    const env = process.env[`RAM_COST_DAYS_${this.slug.replace(/\W/g, '_').toUpperCase()}`]
    const days = { ...this.days, ...(env ? JSON.parse(env) : {}) }
    const report = buildReport(this.title, this.meter, days, readPrice())
    const file = writeReport(report, this.slug)
    const t = report.totals
    const c = report.payer_totals
    console.log(`[ram-cost] ${this.slug}: пик ${fmt(t.peak.bytes)} (${t.peak.stage}), кооператив ${fmt(c.peak.bytes)}; посуточно ${axon(t.axon)}, окно ${axon(t.peak_window_axon)}; остаток ${fmt(t.residual_bytes)}; отчёт ${file}`)
  }
}
