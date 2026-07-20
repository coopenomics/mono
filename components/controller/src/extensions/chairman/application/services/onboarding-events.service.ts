import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  EXTENSION_REPOSITORY,
  ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import type { IConfig } from '../../chairman-extension.module';
import type { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DecisionTrackedEvent } from '~/domain/decision-tracking/events/decision-tracked.event';
import {
  ONBOARDING_COMPLETED_EVENT,
  type OnboardingCompletedPayload,
} from '~/domain/onboarding/events/onboarding-completed.event';

/**
 * Сервис обработки событий онбординга председателя
 * Подписывается на события отслеживания решений и обновляет состояние онбординга
 */
@Injectable()
export class ChairmanOnboardingEventsService {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    private readonly logger: WinstonLoggerService,
    private readonly eventEmitter: EventEmitter2
  ) {
    this.logger.setContext(ChairmanOnboardingEventsService.name);
  }

  /**
   * Все 7 шагов L1-онбординга chairman, по чьим _done флагам определяется
   * завершённость L1 кооператива.
   */
  private static readonly L1_DONE_FLAGS: ReadonlyArray<keyof IConfig> = [
    'onboarding_wallet_agreement_done',
    'onboarding_signature_agreement_done',
    'onboarding_privacy_agreement_done',
    'onboarding_user_agreement_done',
    'onboarding_participant_application_done',
    'onboarding_voskhod_membership_done',
    'onboarding_general_meet_done',
  ];

  private async load(): Promise<ExtensionDomainEntity<IConfig> | null> {
    return this.extensionRepository.findByName('chairman');
  }

  private isExpired(config: IConfig): boolean {
    if (!config.onboarding_expire_at) return false;
    return new Date(config.onboarding_expire_at).getTime() < Date.now();
  }

  /**
   * Обработчик успешного отслеживания решения
   * Вызывается когда фабрика находит совпадение hash и обновляет vars
   */
  @OnEvent(DecisionTrackedEvent.eventName)
  async handleDecisionTracked(event: DecisionTrackedEvent): Promise<void> {
    try {
      const { result } = event;

      // Проверяем что это событие онбординга chairman
      if (!result.metadata?.onboarding_step || result.metadata.extension !== 'chairman') {
        return;
      }

      const step = result.metadata.onboarding_step as string;

      this.logger.debug(`Получено событие отслеживания решения для онбординга chairman: ${result.vars_field}`);

      const plugin = await this.load();
      if (!plugin) {
        this.logger.warn('Конфигурация расширения chairman не найдена');
        return;
      }

      // Определяем ключ флага для обновления на основе metadata
      const flagKey = this.mapStepToFlag(step);

      if (!flagKey) {
        this.logger.warn(`Неизвестный шаг онбординга chairman: ${step}`);
        return;
      }

      const wasAlreadyDone = !!(plugin.config as any)[flagKey];

      // Атомарный частичный UPDATE (config || patch) вместо read-modify-write всего
      // config целиком: несколько DecisionTrackedEvent (согласия/подписи), обработанные
      // конкурентно, иначе теряют флаг друг друга (lost update на общем jsonb-блобе) —
      // тот же класс бага, что чинили в capital-онбординге.
      const updated = await this.extensionRepository.patchConfig('chairman', {
        [flagKey]: true,
      } as Partial<IConfig>);

      this.logger.info(`Онбординг обновлён: ${flagKey} = true (решение ${result.decision_id})`);

      // L1 auto-restart: если переход false → true сделал L1 полностью
      // завершённым, эмиттим ONBOARDING_COMPLETED_EVENT.
      // У chairman нет L2-оферт в реестре сейчас, но событие важно как
      // сигнал «L1 кооператива закрыт» — раздел 7.1 C28-10.
      if (!wasAlreadyDone && this.isL1Complete(updated.config as IConfig)) {
        this.logger.info(
          '[ONBOARDING_COMPLETED] chairman L1 завершён последним шагом, эмиттим событие'
        );
        this.eventEmitter.emit(ONBOARDING_COMPLETED_EVENT, {
          extension_name: 'chairman',
        } satisfies OnboardingCompletedPayload);
      }
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке события отслеживания решения: ${error.message}`, error.stack);
    }
  }

  /**
   * Проверка: все 7 шагов L1-онбординга chairman завершены.
   */
  private isL1Complete(cfg: IConfig): boolean {
    return ChairmanOnboardingEventsService.L1_DONE_FLAGS.every((flag) => !!(cfg as any)[flag]);
  }

  /**
   * Маппинг шага онбординга в ключ флага конфигурации
   */
  private mapStepToFlag(step: string): keyof IConfig | null {
    const mapping: Record<string, keyof IConfig> = {
      wallet_agreement: 'onboarding_wallet_agreement_done',
      signature_agreement: 'onboarding_signature_agreement_done',
      privacy_agreement: 'onboarding_privacy_agreement_done',
      user_agreement: 'onboarding_user_agreement_done',
      participant_application: 'onboarding_participant_application_done',
      voskhod_membership: 'onboarding_voskhod_membership_done',
      general_meet: 'onboarding_general_meet_done',
    };

    return mapping[step] || null;
  }
}
