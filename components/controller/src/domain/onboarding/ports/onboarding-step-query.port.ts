import type { IExtensionOnboardingStepSpec } from '../dto/extension-onboarding-step-spec';

export interface OnboardingStepQueryPort {
  getStepsByExtension(extension_name: string): IExtensionOnboardingStepSpec[];
  getStep(
    extension_name: string,
    step_key: string
  ): IExtensionOnboardingStepSpec | null;
}

export const ONBOARDING_STEP_QUERY_PORT = Symbol('OnboardingStepQueryPort');
