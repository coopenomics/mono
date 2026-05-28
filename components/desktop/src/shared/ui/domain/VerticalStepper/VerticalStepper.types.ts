export interface StepperStep {
  key: string;
  label: string;
  description?: string;
  optional?: boolean;
  disabled?: boolean;
}

export interface VerticalStepperProps {
  steps: StepperStep[];
  /** Ключ активного шага */
  activeKey: string;
  /** Список ключей завершённых шагов */
  completed?: string[];
  /** Список ключей шагов с ошибкой */
  errored?: string[];
  /** Разрешить клик по completed-шагу, чтобы вернуться назад */
  clickableCompleted?: boolean;
}
