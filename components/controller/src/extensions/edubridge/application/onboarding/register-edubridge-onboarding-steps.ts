import type { IOnboardingStepRegistryPort } from '@coopenomics/innercoop';
import { EDUBRIDGE_EXTENSION_NAME } from '../../constants/edubridge.constants';
import { EDU_ONBOARDING_STEPS } from '../../constants/edubridge-agreement-ids';

/**
 * Шаги L1-онбординга кооператива на ЦПП «Образование» — платформенный механизм,
 * как у capital и market: расширение декларирует шаги, generic-слой ведёт
 * решения совета, проставляет `onboarding_<step>_done`, а по завершении всех
 * перезапускает расширение — `initialize()` выставит `coopAcceptance.accepted`
 * и зарегистрирует оферты.
 *
 * Четыре документа (порядок = порядок утверждения советом):
 *  1. Положение ЦПП «Образование» (3000);
 *  2. Шаблон оферты родителя-слушателя (3001);
 *  3. Шаблон оферты преподавателя (3003);
 *  4. Шаблон договора участия в хозяйственной деятельности (3005).
 */
export function registerEdubridgeOnboardingSteps(port: IOnboardingStepRegistryPort): void {
  port.unregisterStepsByExtension(EDUBRIDGE_EXTENSION_NAME);

  const steps: Array<{ key: string; title: string; order: number }> = [
    { key: EDU_ONBOARDING_STEPS.PROVISION, title: 'Утверждение Положения ЦПП «Образование»', order: 10 },
    { key: EDU_ONBOARDING_STEPS.PARENT_OFFER_TEMPLATE, title: 'Утверждение шаблона оферты родителя-слушателя', order: 20 },
    { key: EDU_ONBOARDING_STEPS.TEACHER_OFFER_TEMPLATE, title: 'Утверждение шаблона оферты преподавателя', order: 30 },
    { key: EDU_ONBOARDING_STEPS.CONTRACT_TEMPLATE, title: 'Утверждение шаблона договора участия в хозяйственной деятельности', order: 40 },
  ];

  for (const step of steps) {
    port.registerStep({
      extension_name: EDUBRIDGE_EXTENSION_NAME,
      step_key: step.key,
      event_type: 'SOVIET_DECISION',
      vars_field: step.key,
      generator: 'free_decision',
      default_title: step.title,
      order: step.order,
    });
  }
}
