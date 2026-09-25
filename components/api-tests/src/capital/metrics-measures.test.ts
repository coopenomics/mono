/**
 * Меры кооператива и дневной ряд метрик (реестр capital.metrics-measures).
 *
 * Мера — «название + единица», её вписывают текстом в цель на компоненте, и
 * она попадает в собственную коллекцию кооператива. Повтор пары не плодит
 * дубль. Таймфрейм ряда, волны и резонанса — день, окно — 30 дневных баров.
 *
 * Цели заводятся на персональном проекте свежего пайщика: он владелец и
 * управляет метриками, а цепь для мер не нужна. Меры общие для кооператива,
 * поэтому у каждой пары своя метка прогона — чужие файлы стенда их не заденут.
 */
import type { Who } from '../core'
import { beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, caseName, freshMember, gql, gqlError, login, tokenOf } from '../core'
import {
  runTag,
} from './cap-metrics.helpers'
import { createLocalProject } from './cap-access.helpers'

const METRIC_FIELDS = 'metric_hash measure_hash project_hash title unit series_mode target_value fact status created_by'
const MEASURE_FIELDS = 'measure_hash coopname title unit series_mode status created_by'

const CREATE_METRIC = `mutation($d:CreateComponentMetricInput!){ capitalCreateComponentMetric(data:$d){ ${METRIC_FIELDS} } }`
const UPDATE_METRIC = `mutation($d:UpdateComponentMetricInput!){ capitalUpdateComponentMetric(data:$d){ ${METRIC_FIELDS} } }`
const UPDATE_MEASURE = `mutation($d:UpdateMeasureInput!){ capitalUpdateMeasure(data:$d){ ${MEASURE_FIELDS} } }`
const MEASURES = `query($d:GetMeasuresInput!){ capitalMeasures(data:$d){ ${MEASURE_FIELDS} } }`
const COMPONENT_METRICS = `query($d:GetComponentMetricsInput!){ capitalComponentMetrics(data:$d){ ${METRIC_FIELDS} } }`
const LOG_CONTRIBUTION = 'mutation($d:LogMetricContributionInput!){ capitalLogMetricContribution(data:$d){ contribution_hash delta occurred_at } }'
const SERIES = 'query($d:GetMetricSeriesInput!){ capitalMetricSeries(data:$d){ metric_hash fact series_mode points{ period_start period_end delta cumulative } } }'
const HISTORY = 'query($d:GetMetricSuperpositionHistoryInput!){ capitalMetricSuperpositionHistory(data:$d){ from to frames{ at fact_sum items{ metric_hash fact recent_velocity amplitude } } } }'

const DAY_MS = 24 * 60 * 60 * 1000

let owner = ''
let token = ''
let who: Who
let project = ''
let tag = ''

async function createMetric(d: Record<string, unknown>): Promise<any> {
  const r = await gql<any>(token, CREATE_METRIC, { d: { coopname: COOP, project_hash: project, target_value: 10, ...d } })
  return r.capitalCreateComponentMetric
}

async function measures(): Promise<any[]> {
  const r = await gql<any>(token, MEASURES, { d: { coopname: COOP } })
  return r.capitalMeasures
}

async function measureByHash(hash: string): Promise<any | undefined> {
  return (await measures()).find(m => m.measure_hash === hash)
}

describe('Благорост — меры кооператива и дневной ряд метрик', () => {
  beforeAll(async () => {
    who = freshMember({ prefix: 'capm' })
    owner = who.account
    token = await login(who)
    tag = runTag()
    project = (await createLocalProject(who, `Меры ${tag}`, { description: 'Проект внешнего теста мер.' })).project_hash
  })

  // ── Меры ──────────────────────────────────────────────────────────────────

  it(caseName('cap.mm.happy.01', 'цель с мерой, вписанной текстом, заводит меру в коллекции кооператива'), async () => {
    const metric = await createMetric({ title: `Заявки ${tag}`, unit: 'шт' })
    expect(metric.title).toBe(`Заявки ${tag}`)
    expect(metric.unit).toBe('шт')
    expect(metric.project_hash).toBe(project)

    const measure = await measureByHash(metric.measure_hash)
    expect(measure, 'мера обязана появиться в коллекции кооператива').toBeTruthy()
    expect(measure).toMatchObject({ coopname: COOP, title: `Заявки ${tag}`, unit: 'шт', status: 'ACTIVE', created_by: owner })

    const onComponent = await gql<any>(token, COMPONENT_METRICS, { d: { project_hash: project } })
    const bound = onComponent.capitalComponentMetrics.find((m: any) => m.metric_hash === metric.metric_hash)
    expect(bound?.measure_hash, 'цель обязана смотреть на заведённую меру').toBe(metric.measure_hash)
  })

  it(caseName('cap.mm.side.15', 'цель на чужой кооператив — отказ, цель не заводится'), async () => {
    // До 25.09.2026 кооператив цели брался из ввода как есть (C28-80).
    const title = `Чужая ${tag}`
    const err = await gqlError(token, CREATE_METRIC, { d: { coopname: 'othercoop', project_hash: project, target_value: 10, title, unit: 'шт' } })
    expect(err?.code).toBe('CAPITAL_METRIC_FOREIGN_COOPERATIVE')
    const onComponent = await gql<any>(token, COMPONENT_METRICS, { d: { project_hash: project } })
    expect(onComponent.capitalComponentMetrics.map((m: any) => m.title)).not.toContain(title)
  })

  it(caseName('cap.mm.side.01', 'та же пара во второй цели не плодит дубль'), async () => {
    const first = await createMetric({ title: `Звонки ${tag}`, unit: 'шт' })
    const second = await createMetric({ title: `Звонки ${tag}`, unit: 'шт', target_value: 20 })
    expect(second.metric_hash).not.toBe(first.metric_hash)
    expect(second.measure_hash, 'обе цели обязаны смотреть на одну меру').toBe(first.measure_hash)

    const same = (await measures()).filter(m => m.title === `Звонки ${tag}` && m.unit === 'шт')
    expect(same).toHaveLength(1)
  })

  it(caseName('cap.mm.side.02', 'пробелы по краям обрезаются, дубля не возникает'), async () => {
    const spaced = await createMetric({ title: `  Отгрузки ${tag}  `, unit: '  кг ' })
    expect(spaced.title).toBe(`Отгрузки ${tag}`)
    expect(spaced.unit).toBe('кг')

    const clean = await createMetric({ title: `Отгрузки ${tag}`, unit: 'кг' })
    expect(clean.measure_hash, 'обрезанная пара — та же мера').toBe(spaced.measure_hash)
    const same = (await measures()).filter(m => m.title === `Отгрузки ${tag}` && m.unit === 'кг')
    expect(same).toHaveLength(1)
  })

  it(caseName('cap.mm.side.03', 'цель по выключенной мере включает её обратно, новая не заводится'), async () => {
    const first = await createMetric({ title: `Архивная ${tag}`, unit: 'ч' })
    const archived = await gql<any>(await tokenOf(CHAIRMAN), UPDATE_MEASURE, { d: { measure_hash: first.measure_hash, status: 'ARCHIVED' } })
    expect(archived.capitalUpdateMeasure.status).toBe('ARCHIVED')

    const again = await createMetric({ title: `Архивная ${tag}`, unit: 'ч' })
    expect(again.measure_hash, 'новая мера заводиться не должна').toBe(first.measure_hash)
    const measure = await measureByHash(first.measure_hash)
    expect(measure?.status, 'мера обязана вернуться в строй').toBe('ACTIVE')
    expect((await measures()).filter(m => m.title === `Архивная ${tag}` && m.unit === 'ч')).toHaveLength(1)
  })

  it(caseName('cap.mm.side.13', 'тип «уровень» в строке цели заводит меру с режимом ряда LEVEL'), async () => {
    const metric = await createMetric({ title: `Вес ${tag}`, unit: 'кг', series_mode: 'LEVEL' })
    expect(metric.series_mode).toBe('LEVEL')
    expect((await measureByHash(metric.measure_hash))?.series_mode).toBe('LEVEL')
  })

  it(caseName('cap.mm.side.14', 'явное переключение типа у заведённой меры меняет её режим, новая не заводится'), async () => {
    const first = await createMetric({ title: `Настроение ${tag}`, unit: 'балл' })
    expect(first.series_mode, 'по умолчанию мера — скорость').toBe('RATE')

    const switched = await createMetric({ title: `Настроение ${tag}`, unit: 'балл', series_mode: 'LEVEL' })
    expect(switched.measure_hash).toBe(first.measure_hash)
    expect(switched.series_mode).toBe('LEVEL')
    expect((await measureByHash(first.measure_hash))?.series_mode).toBe('LEVEL')
  })

  it(caseName('cap.mm.break.04', 'цель по мере-уровню без типа в запросе не сбрасывает режим в «скорость»'), async () => {
    const level = await createMetric({ title: `Остаток ${tag}`, unit: 'л', series_mode: 'LEVEL' })
    expect(level.series_mode).toBe('LEVEL')

    const noMode = await createMetric({ title: `Остаток ${tag}`, unit: 'л', target_value: 5 })
    expect(noMode.measure_hash).toBe(level.measure_hash)
    expect(noMode.series_mode, 'режим меры обязан сохраниться').toBe('LEVEL')

    // Правка цели без поля типа — тот же путь через сохранённую меру.
    const updated = await gql<any>(token, UPDATE_METRIC, { d: { metric_hash: noMode.metric_hash, target_value: 7 } })
    expect(updated.capitalUpdateComponentMetric.series_mode).toBe('LEVEL')
    expect((await measureByHash(level.measure_hash))?.series_mode).toBe('LEVEL')
  })

  it(caseName('cap.mm.side.04', 'смена названия меры в цели заводит новую меру, старая не трогается'), async () => {
    const keep = await createMetric({ title: `Встречи ${tag}`, unit: 'шт' })
    const renamed = await createMetric({ title: `Встречи ${tag}`, unit: 'шт' })

    const r = await gql<any>(token, UPDATE_METRIC, { d: { metric_hash: renamed.metric_hash, title: `Собрания ${tag}` } })
    const after = r.capitalUpdateComponentMetric
    expect(after.title).toBe(`Собрания ${tag}`)
    expect(after.measure_hash, 'у цели обязана появиться новая мера').not.toBe(keep.measure_hash)

    const old = await measureByHash(keep.measure_hash)
    expect(old, 'старая мера обязана остаться').toMatchObject({ title: `Встречи ${tag}`, unit: 'шт' })
    const onComponent = await gql<any>(token, COMPONENT_METRICS, { d: { project_hash: project } })
    const other = onComponent.capitalComponentMetrics.find((m: any) => m.metric_hash === keep.metric_hash)
    expect(other?.title, 'переименование не должно поехать по другим целям с той же мерой').toBe(`Встречи ${tag}`)
  })

  it(caseName('cap.mm.break.01', 'переименование меры в уже существующую пару отклоняется'), async () => {
    const a = await createMetric({ title: `Альфа ${tag}`, unit: 'шт' })
    const b = await createMetric({ title: `Бета ${tag}`, unit: 'шт' })

    const err = await gqlError(await tokenOf(CHAIRMAN), UPDATE_MEASURE, { d: { measure_hash: a.measure_hash, title: `Бета ${tag}`, unit: 'шт' } })
    expect(err?.code).toBe('CAPITAL_MEASURE_DUPLICATE')

    expect((await measureByHash(a.measure_hash))?.title, 'отклонённое переименование ничего не меняет').toBe(`Альфа ${tag}`)
    expect((await measures()).filter(m => m.title === `Бета ${tag}` && m.unit === 'шт').map(m => m.measure_hash)).toEqual([b.measure_hash])
  })

  it(caseName('cap.mm.break.02', 'цель без названия меры или без единицы отклоняется, мера не создаётся'), async () => {
    const noTitle = await gqlError(token, CREATE_METRIC, { d: { coopname: COOP, project_hash: project, target_value: 1, unit: 'шт' } })
    expect(noTitle?.code).toBe('CAPITAL_MEASURE_INPUT_REQUIRED')
    expect(noTitle?.message, 'отказ обязан объяснять причину').toBeTruthy()

    const blankTitle = await gqlError(token, CREATE_METRIC, { d: { coopname: COOP, project_hash: project, target_value: 1, title: '   ', unit: 'шт' } })
    expect(blankTitle?.code).toBe('CAPITAL_MEASURE_INPUT_REQUIRED')

    const noUnit = await gqlError(token, CREATE_METRIC, { d: { coopname: COOP, project_hash: project, target_value: 1, title: `Безъединицы ${tag}` } })
    expect(noUnit?.code).toBe('CAPITAL_MEASURE_UNIT_MISSING')
    expect(noUnit?.message).toBeTruthy()

    expect((await measures()).filter(m => m.title === `Безъединицы ${tag}`), 'мера не должна создаться').toHaveLength(0)
  })

  it(caseName('cap.mm.side.05', 'список мер — только заведённые кооперативом, без общего справочника'), async () => {
    const own = await createMetric({ title: `Своя ${tag}`, unit: 'шт' })
    const list = await measures()
    expect(list.some(m => m.measure_hash === own.measure_hash)).toBe(true)
    for (const m of list)
      expect(m.coopname, `мера ${m.measure_hash} чужого кооператива в списке`).toBe(COOP)
    // Сид общего справочника шёл от имени system; кооператив заводит меры сам.
    expect(list.filter(m => m.created_by === 'system'), 'общий справочник подсеиваться не должен').toHaveLength(0)
  })

  // ── Дневной ряд и резонанс ────────────────────────────────────────────────

  describe('ряд и история резонанса', () => {
    let seriesProject = ''
    let metricHash = ''
    const DELTA = 3

    beforeAll(async () => {
      // Отдельный компонент: резонанс считается по всем целям компонента, а
      // здесь нужна ровно одна цель с одним сегодняшним вкладом.
      seriesProject = (await createLocalProject(who, `Ряд ${tag}`, { description: 'Проект внешнего теста ряда метрики.' })).project_hash
      const r = await gql<any>(token, CREATE_METRIC, { d: { coopname: COOP, project_hash: seriesProject, target_value: 30, title: `Ряд ${tag}`, unit: 'шт' } })
      metricHash = r.capitalCreateComponentMetric.metric_hash
      await gql(token, LOG_CONTRIBUTION, { d: { metric_hash: metricHash, delta: DELTA } })
    })

    it(caseName('cap.mm.happy.02', 'ряд за окно по умолчанию — 30 дневных баров, последний — текущие сутки'), async () => {
      const before = Date.now()
      const r = await gql<any>(token, SERIES, { d: { metric_hash: metricHash } })
      const s = r.capitalMetricSeries
      expect(s.points).toHaveLength(30)

      for (const p of s.points)
        expect(Date.parse(p.period_end) - Date.parse(p.period_start), 'бар — ровно сутки').toBe(DAY_MS)

      const last = s.points.at(-1)
      expect(Date.parse(last.period_start)).toBeLessThanOrEqual(before)
      expect(Date.parse(last.period_end), 'последний бар — незавершённые текущие сутки').toBeGreaterThan(before)
      expect(last.delta, 'сегодняшний вклад лежит в последнем баре').toBe(DELTA)
      expect(s.fact).toBe(DELTA)
    })

    it(caseName('cap.mm.side.06', 'правая граница на начале суток не добавляет пустой «будущий» бар'), async () => {
      const now = new Date()
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const r = await gql<any>(token, SERIES, { d: { metric_hash: metricHash, to: midnight.toISOString() } })
      const points = r.capitalMetricSeries.points
      expect(points.length).toBeGreaterThan(0)

      const last = points.at(-1)
      expect(Date.parse(last.period_end), 'последний бар обязан закончиться ровно на границе').toBe(midnight.getTime())
      expect(points.filter((p: any) => Date.parse(p.period_start) >= midnight.getTime()), 'бара на пустые будущие сутки быть не должно').toHaveLength(0)
      expect(points.every((p: any) => p.delta === 0), 'сегодняшний вклад в окно до полуночи не входит').toBe(true)
    })

    it(caseName('cap.mm.side.09', 'история резонанса — кадры по дням, последний упирается в текущий момент'), async () => {
      const before = Date.now()
      const r = await gql<any>(token, HISTORY, { d: { project_hash: seriesProject } })
      const after = Date.now()
      const h = r.capitalMetricSuperpositionHistory
      const frames = h.frames
      expect(frames).toHaveLength(30)

      const last = frames.at(-1)
      expect(last.at, 'последний кадр — момент запроса').toBe(h.to)
      expect(Date.parse(last.at)).toBeGreaterThanOrEqual(before - 1000)
      expect(Date.parse(last.at), 'а не конец незавершённых суток').toBeLessThanOrEqual(after + 1000)

      for (let i = 0; i < frames.length - 1; i++) {
        const at = new Date(frames[i].at)
        expect(at.getUTCHours() + at.getUTCMinutes() + at.getUTCSeconds() + at.getUTCMilliseconds(), `кадр ${i} — граница суток`).toBe(0)
        if (i > 0)
          expect(Date.parse(frames[i].at) - Date.parse(frames[i - 1].at), 'кадры идут по дням').toBe(DAY_MS)
      }
    })

    it(caseName('cap.mm.side.10', 'вклад позже кадра истории не входит в его факт и фазоры'), async () => {
      const r = await gql<any>(token, HISTORY, { d: { project_hash: seriesProject } })
      const frames = r.capitalMetricSuperpositionHistory.frames
      // Предпоследний кадр — начало текущих суток: сегодняшний вклад позже него.
      const beforeContribution = frames.at(-2).items.find((i: any) => i.metric_hash === metricHash)
      const current = frames.at(-1).items.find((i: any) => i.metric_hash === metricHash)

      expect(beforeContribution, 'цель компонента присутствует в кадре').toBeTruthy()
      expect(beforeContribution.fact, 'вклад позже кадра не входит в факт').toBe(0)
      expect(beforeContribution.recent_velocity).toBe(0)
      expect(beforeContribution.amplitude, 'и не раскачивает фазор кадра').toBe(0)
      expect(frames.at(-2).fact_sum).toBe(0)

      expect(current.fact, 'в текущий кадр вклад входит').toBe(DELTA)
      expect(current.amplitude).toBeGreaterThan(0)
    })
  })
})
