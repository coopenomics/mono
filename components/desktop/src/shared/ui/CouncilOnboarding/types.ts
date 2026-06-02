/**
 * Универсальные типы для компонента онбординга с собраниями совета
 */

export type CouncilOnboardingStepStatus = 'pending' | 'in_progress' | 'completed';

export interface ICouncilOnboardingStep {
  id: string;
  title: string;
  description: string;
  status: CouncilOnboardingStepStatus;
  question: string;
  decision: string;
  decisionPrefix?: string;
  hash?: string | null;
  depends_on?: string[]; // ID шагов, которые должны быть завершены перед этим шагом
}

/**
 * Доп. шаг онбординга, не связанный с собранием совета: навигация на другой
 * стол (например «добавить кооперативные участки», «назначить ПВЗ»). Рисуется в
 * том же списке после шагов совета, продолжая сквозную нумерацию.
 */
export interface ICouncilOnboardingExtraStep {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  disabled?: boolean;
}

export interface ICouncilOnboardingConfig {
  steps: ICouncilOnboardingStep[];
  expireAt?: Date | null;
  completionMessage?: string;
  completionTitle?: string;
}

export interface ICouncilOnboardingActions {
  onStepClick: (step: ICouncilOnboardingStep) => void;
  onStepSubmit: (step: ICouncilOnboardingStep) => Promise<void>;
  checkCompletion?: () => boolean;
}
