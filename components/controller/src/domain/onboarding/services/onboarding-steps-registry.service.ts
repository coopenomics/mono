import { Injectable } from '@nestjs/common';
import type { IExtensionOnboardingStepSpec } from '../dto/extension-onboarding-step-spec';
import type { OnboardingStepRegistrationPort } from '../ports/onboarding-step-registration.port';
import type { OnboardingStepQueryPort } from '../ports/onboarding-step-query.port';

@Injectable()
export class OnboardingStepsRegistryService
  implements OnboardingStepRegistrationPort, OnboardingStepQueryPort
{
  private readonly steps: IExtensionOnboardingStepSpec[] = [];

  public registerStep(spec: IExtensionOnboardingStepSpec): void {
    const duplicate = this.steps.find(
      (s) =>
        s.extension_name === spec.extension_name && s.step_key === spec.step_key
    );
    if (duplicate) {
      throw new Error(
        `Шаг онбординга уже зарегистрирован: ${spec.extension_name}/${spec.step_key}`
      );
    }
    this.steps.push({ ...spec });
  }

  public unregisterStepsByExtension(extension_name: string): void {
    for (let i = this.steps.length - 1; i >= 0; i--) {
      if (this.steps[i]?.extension_name === extension_name) {
        this.steps.splice(i, 1);
      }
    }
  }

  public getStepsByExtension(
    extension_name: string
  ): IExtensionOnboardingStepSpec[] {
    return this.steps
      .filter((s) => s.extension_name === extension_name)
      .sort((a, b) => a.order - b.order);
  }

  public getStep(
    extension_name: string,
    step_key: string
  ): IExtensionOnboardingStepSpec | null {
    return (
      this.steps.find(
        (s) => s.extension_name === extension_name && s.step_key === step_key
      ) ?? null
    );
  }
}
