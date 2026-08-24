import { isTariffChoiceAvailable } from './tariffs'

/**
 * Индексы шагов подключения — единственный источник правды.
 *
 * Раньше числа были расставлены по месту: страница восстанавливала шаг числом,
 * шаг союза вёл на «1», шаг домена возвращался на «текущий минус один». Стоило
 * убрать шаг из мастера, и каждое такое число нужно было искать заново.
 */
export const CONNECTION_STEP = {
  union: 0,
  intro: 1,
  profile: 2,
  domain: 3,
  financial: 4,
  agreement: 5,
  dns: 6,
  approval: 7,
  installation: 8,
} as const

/** С чего начинается онбординг: тариф показывается, только когда есть выбор. */
export const FIRST_ONBOARDING_STEP: number = isTariffChoiceAvailable
  ? CONNECTION_STEP.intro
  : CONNECTION_STEP.profile

/** Последний шаг мастера — дальше только дашборд подключения. */
export const LAST_CONNECTION_STEP: number = CONNECTION_STEP.installation

/**
 * Предыдущий ПОКАЗАННЫЙ шаг мастера — или null, если текущий первый.
 *
 * Видимых шагов меньше, чем индексов: шаг союза показывается только его членам,
 * шаг тарифа — только когда есть из чего выбирать. Считать «текущий минус один»
 * поэтому нельзя: у кооператива из союза первым экраном онбординга идёт рассказ
 * о себе, а вернуться из него надо на союз, который лежит на два индекса назад.
 */
export function previousVisibleStep(
  currentStep: number,
  options: { isUnioned: boolean },
): number | null {
  const visible = [
    ...(options.isUnioned ? [CONNECTION_STEP.union] : []),
    ...(isTariffChoiceAvailable ? [CONNECTION_STEP.intro] : []),
    CONNECTION_STEP.profile,
    CONNECTION_STEP.domain,
    CONNECTION_STEP.financial,
    CONNECTION_STEP.agreement,
    CONNECTION_STEP.dns,
    CONNECTION_STEP.approval,
    CONNECTION_STEP.installation,
  ]
  const position = visible.indexOf(currentStep)
  if (position <= 0) return null
  return visible[position - 1] as number
}
