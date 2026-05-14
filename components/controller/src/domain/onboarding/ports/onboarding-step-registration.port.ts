import type { IExtensionOnboardingStepSpec } from '../dto/extension-onboarding-step-spec';

export interface OnboardingStepRegistrationPort {
  registerStep(spec: IExtensionOnboardingStepSpec): void;
  unregisterStepsByExtension(extension_name: string): void;
}

export const ONBOARDING_STEP_REGISTRATION_PORT = Symbol(
  'OnboardingStepRegistrationPort'
);
