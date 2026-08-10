import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  ONBOARDING_COMPLETED_EVENT,
  type OnboardingCompletedPayload,
} from '../events/onboarding-completed.event';
import {
  ONBOARDING_STEP_QUERY_PORT,
  type OnboardingStepQueryPort,
} from '../ports/onboarding-step-query.port';
import { DecisionTrackedEvent } from '@coopenomics/innercoop';

/**
 * Расширения с собственным per-extension events-сервисом
 * (см. {Capital,Chairman}OnboardingEventsService). Generic-слушатель
 * пропускает их, чтобы избежать double-update флага и double-emit
 * ONBOARDING_COMPLETED. После удаления legacy сервисов в одном из
 * следующих эпиков (когда capital/chairman перестанут хардкодить свои
 * step-mapping'и) этот список схлопнётся до пустого.
 */
const LEGACY_EXTENSIONS_WITH_OWN_LISTENER: ReadonlyArray<string> = [
  'chairman',
  'capital',
];

const doneKey = (step_key: string) => `onboarding_${step_key}_done`;

@Injectable()
export class ExtensionOnboardingEventsService {
  constructor(
    @Inject(EXTENSION_REPOSITORY)
    private readonly extensionRepository: ExtensionDomainRepository<
      Record<string, unknown>
    >,
    @Inject(ONBOARDING_STEP_QUERY_PORT)
    private readonly stepsRegistry: OnboardingStepQueryPort,
    private readonly logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.logger.setContext(ExtensionOnboardingEventsService.name);
  }

  @OnEvent(DecisionTrackedEvent.eventName)
  async handleDecisionTracked(event: DecisionTrackedEvent): Promise<void> {
    const { result } = event;
    if (!result.metadata?.onboarding_step || !result.metadata.extension) return;

    const extension_name = String(result.metadata.extension);
    const step_key = String(result.metadata.onboarding_step);

    if (LEGACY_EXTENSIONS_WITH_OWN_LISTENER.includes(extension_name)) {
      return;
    }

    const spec = this.stepsRegistry.getStep(extension_name, step_key);
    if (!spec) {
      this.logger.debug(
        `Шаг ${extension_name}/${step_key} не найден в OnboardingStepsRegistry — пропуск`
      );
      return;
    }

    try {
      const extension = await this.extensionRepository.findByName(extension_name);
      if (!extension) {
        this.logger.warn(`Расширение ${extension_name} не найдено в репозитории`);
        return;
      }

      const flagKey = doneKey(step_key);
      const wasAlreadyDone = Boolean(extension.config[flagKey]);
      if (wasAlreadyDone) return;

      // Атомарный merge одного флага: два решения совета по РАЗНЫМ шагам,
      // утверждённые почти одновременно, иначе теряли бы друг друга (оба
      // читают config без обоих флагов и пишут весь блоб назад). merged —
      // свежий слитый config (под локом), поэтому allDone видит оба флага.
      const merged = await this.extensionRepository.patchConfig(extension_name, {
        [flagKey]: true,
      });
      this.logger.info(`Онбординг ${extension_name}: ${flagKey} = true`);

      const specs = this.stepsRegistry.getStepsByExtension(extension_name);
      const allDone =
        specs.length > 0 &&
        specs.every((s) => Boolean(merged.config[doneKey(s.step_key)]));
      if (allDone) {
        this.logger.info(
          `[ONBOARDING_COMPLETED] ${extension_name}: все шаги завершены`
        );
        this.eventEmitter.emit(ONBOARDING_COMPLETED_EVENT, {
          extension_name,
        } satisfies OnboardingCompletedPayload);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Ошибка обработки DecisionTrackedEvent для ${extension_name}/${step_key}: ${err.message}`,
        err.stack
      );
    }
  }
}
