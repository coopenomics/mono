import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  EXTENSION_REPOSITORY,
  type ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { DecisionTrackedEvent } from '~/domain/decision-tracking/events/decision-tracked.event';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  ONBOARDING_COMPLETED_EVENT,
  type OnboardingCompletedPayload,
} from '../events/onboarding-completed.event';
import {
  ONBOARDING_STEP_QUERY_PORT,
  type OnboardingStepQueryPort,
} from '../ports/onboarding-step-query.port';

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
      const plugin = await this.extensionRepository.findByName(extension_name);
      if (!plugin) {
        this.logger.warn(`Расширение ${extension_name} не найдено в репозитории`);
        return;
      }

      const flagKey = doneKey(step_key);
      const wasAlreadyDone = Boolean(plugin.config[flagKey]);
      if (wasAlreadyDone) return;

      const updatedConfig: Record<string, unknown> = {
        ...plugin.config,
        [flagKey]: true,
      };
      await this.extensionRepository.update({ ...plugin, config: updatedConfig });
      this.logger.info(`Онбординг ${extension_name}: ${flagKey} = true`);

      const specs = this.stepsRegistry.getStepsByExtension(extension_name);
      const allDone =
        specs.length > 0 &&
        specs.every((s) => Boolean(updatedConfig[doneKey(s.step_key)]));
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
