export type OnboardingStepEventType = 'SOVIET_DECISION' | 'MEET_DECISION';

export type OnboardingStepGenerator = 'free_decision' | 'meet';

export interface IExtensionOnboardingStepSpec {
  extension_name: string;
  step_key: string;
  event_type: OnboardingStepEventType;
  vars_field: string;
  generator: OnboardingStepGenerator;
  default_title?: string;
  order: number;
}
