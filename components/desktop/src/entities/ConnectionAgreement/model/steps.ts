import { isTariffChoiceAvailable } from './tariffs'

/**
 * Индексы шагов подключения — единственный источник правды.
 *
 * Раньше числа были расставлены по месту: страница восстанавливала шаг числом,
 * шаг союза вёл на «1», шаг домена возвращался на «текущий минус один». Стоило
 * убрать шаг из мастера, и каждое такое число нужно было искать заново.
 *
 * Индекс 0 занимал шаг членства в союзе (мессенджер). Шаг снят 20.10.2026 —
 * подключение начинается с тарифа; номера остальных не сдвигаются, текущий шаг
 * хранится между сессиями числом.
 */
export const CONNECTION_STEP = {
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
 * Видимых шагов меньше, чем индексов: шаг тарифа показывается, только когда
 * есть из чего выбирать. Считать «текущий минус один» поэтому нельзя.
 */
export function previousVisibleStep(currentStep: number): number | null {
  const visible: number[] = [
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
