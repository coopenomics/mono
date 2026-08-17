/**
 * Подключение расширения к кооперативу — шаги, которые совет проходит один раз,
 * прежде чем расширением можно пользоваться.
 *
 * Расширение объявляет свои шаги при запуске, а ведёт их ядро: оно знает, как
 * выносится решение совета и как считается собрание. Раньше расширение
 * инжектило `ONBOARDING_STEP_REGISTRATION_PORT` по пути `~/domain/onboarding`,
 * которого за пределами монолита нет.
 */

/** Чем закрывается шаг: решением совета или решением общего собрания. */
export type InnerOnboardingDecisionKind = 'SOVIET_DECISION' | 'MEET_DECISION';

/** Чем шаг создаётся: свободным решением или собранием. */
export type InnerOnboardingGenerator = 'free_decision' | 'meet';

export interface InnerOnboardingStep {
  /** Расширение, которому шаг принадлежит; совпадает с его именем в реестре. */
  extension_name: string;
  /** Ключ шага внутри расширения — по нему отмечается прохождение. */
  step_key: string;
  event_type: InnerOnboardingDecisionKind;
  /** Поле решения, из которого берётся результат шага. */
  vars_field: string;
  generator: InnerOnboardingGenerator;
  default_title?: string;
  /** Порядок в списке: шаги проходятся сверху вниз. */
  order: number;
}

export interface IOnboardingStepRegistryPort {
  registerStep(step: InnerOnboardingStep): void;

  /**
   * Снять все шаги расширения — при остановке или переустановке. Иначе после
   * перезапуска шаги задвоятся.
   */
  unregisterStepsByExtension(extensionName: string): void;
}

export const ONBOARDING_STEP_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.OnboardingStepRegistry');

/**
 * Расширение прошло подключение целиком — все его шаги отмечены.
 *
 * Ядро на это событие перезапускает расширение, чтобы оно перерегистрировало
 * свои оферты и программы с уже заполненной настройкой; ручного действия
 * совета не требуется.
 */
export const ONBOARDING_COMPLETED_EVENT = 'onboarding.completed' as const;

export interface InnerOnboardingCompletedPayload {
  extension_name: string;
}
