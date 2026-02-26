import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DecisionTrackedEvent } from '~/domain/decision-tracking/events/decision-tracked.event';
import { ParticipantRegisteredEvent } from '~/domain/participant/interfaces/participant-registered-event.interface';
import { ProgramKey } from '~/domain/registration/enum';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  EXTENSION_REPOSITORY,
  ExtensionDomainRepository,
} from '~/domain/extension/repositories/extension-domain.repository';
import { AccountDataPort, ACCOUNT_DATA_PORT } from '~/domain/account/ports/account-data.port';
import type { IConfig } from '../../capital-extension.module';
import { CONTRIBUTOR_REPOSITORY } from '../../domain/repositories/contributor.repository';
import { ContributorRepository } from '../../domain/repositories/contributor.repository';
import { ContributorDomainEntity } from '../../domain/entities/contributor.entity';
import { ContributorStatus } from '../../domain/enums/contributor-status.enum';
import config from '~/config/config';
import { generateRandomHash } from '~/utils/generate-hash.util';

@Injectable()
export class CapitalOnboardingEventsService {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(CONTRIBUTOR_REPOSITORY) private readonly contributorRepository: ContributorRepository,
    @Inject(ACCOUNT_DATA_PORT) private readonly accountDataPort: AccountDataPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(CapitalOnboardingEventsService.name);
  }

  @OnEvent(DecisionTrackedEvent.eventName)
  async handleDecisionTracked(event: DecisionTrackedEvent): Promise<void> {
    const { result } = event;

    // Проверяем, относится ли событие к онбордингу capital
    if (!result.metadata?.onboarding_step || result.metadata.extension !== 'capital') return;

    const step = result.metadata.onboarding_step as string;

    this.logger.info(`Получено событие завершения онбординга capital для шага: ${step}`);

    try {
      const plugin = await this.extensionRepository.findByName('capital');
      if (!plugin) {
        this.logger.error('Конфигурация расширения capital не найдена');
        return;
      }

      // Определяем ключ флага для обновления
      const flagKey = this.mapStepToFlag(step);

      if (!flagKey) {
        this.logger.warn(`Неизвестный шаг онбординга capital: ${step}`);
        return;
      }

      // Обновляем флаг завершения шага
      const updatedConfig = {
        ...plugin.config,
        [flagKey]: true,
      };

      await this.extensionRepository.update({ ...plugin, config: updatedConfig });

      this.logger.info(`Флаг ${flagKey} установлен в true`);
    } catch (error) {
      const errorObj = error as Error;
      this.logger.error(`Ошибка при обработке события завершения онбординга capital: ${errorObj.message}`, errorObj.stack);
    }
  }

  @OnEvent('participant::registered')
  async handleParticipantRegistered(event: ParticipantRegisteredEvent): Promise<void> {
    const { username, program_key, blagorost_offer_hash, generator_offer_hash } = event;

    this.logger.info(`Получено событие регистрации участника: ${username}, program_key: ${program_key}, coopname: ${config.coopname}`);

    // Создаем Contributor только если указана программа (для кооперативов, поддерживающих CAPITAL)
    if (!program_key) {
      this.logger.debug(`Программа не указана для участника ${username}, пропускаем создание Contributor`);
      return;
    }

    // Проверяем наличие необходимых данных
    if (!config.coopname) {
      this.logger.error(`config.coopname не определен, невозможно создать Contributor для ${username}`);
      return;
    }

    try {
      // Проверяем, существует ли уже Contributor для этого пользователя
      const existingContributor = await this.contributorRepository.findByUsername(username);

      if (existingContributor) {
        this.logger.info(`Contributor для пользователя ${username} уже существует, обновляем данные`);
        let needsUpdate = false;

        // Обновляем program_key если он изменился
        if (existingContributor.program_key !== program_key) {
          existingContributor.program_key = program_key;
          needsUpdate = true;
          this.logger.info(`Обновлен program_key для Contributor ${username}: ${program_key}`);
        }

        // Определяем актуальные хэши оферт в зависимости от программы
        let actualBlagorostOfferHash: string | undefined;
        let actualGeneratorOfferHash: string | undefined;

        if (program_key === ProgramKey.CAPITALIZATION) {
          actualBlagorostOfferHash = blagorost_offer_hash;
          actualGeneratorOfferHash = undefined;
        } else if (program_key === ProgramKey.GENERATION) {
          actualBlagorostOfferHash = undefined;
          actualGeneratorOfferHash = generator_offer_hash;
        } else {
          // Для других программ или если программа не указана - очищаем оба хэша
          actualBlagorostOfferHash = undefined;
          actualGeneratorOfferHash = undefined;
        }

        // Обновляем хэши оферт если они изменились
        if (existingContributor.blagorost_offer_hash !== actualBlagorostOfferHash) {
          existingContributor.blagorost_offer_hash = actualBlagorostOfferHash;
          needsUpdate = true;
          this.logger.info(`Обновлен blagorost_offer_hash для Contributor ${username}: ${actualBlagorostOfferHash}`);
        }

        if (existingContributor.generator_offer_hash !== actualGeneratorOfferHash) {
          existingContributor.generator_offer_hash = actualGeneratorOfferHash;
          needsUpdate = true;
          this.logger.info(`Обновлен generator_offer_hash для Contributor ${username}: ${actualGeneratorOfferHash}`);
        }

        if (needsUpdate) {
          await this.contributorRepository.update(existingContributor);
        }
        return;
      }

      // Определяем актуальные хэши оферт в зависимости от программы
      let actualBlagorostOfferHash: string | undefined;
      let actualGeneratorOfferHash: string | undefined;

      if (program_key === ProgramKey.CAPITALIZATION) {
        actualBlagorostOfferHash = blagorost_offer_hash;
        actualGeneratorOfferHash = undefined;
      } else if (program_key === ProgramKey.GENERATION) {
        actualBlagorostOfferHash = undefined;
        actualGeneratorOfferHash = generator_offer_hash;
      } else {
        // Для других программ или если программа не указана - очищаем оба хэша
        actualBlagorostOfferHash = undefined;
        actualGeneratorOfferHash = undefined;
      }

      // Получаем display_name через порт расширения
      const displayName = await this.accountDataPort.getDisplayName(username);

      // Создаем нового Contributor
      const contributorData = {
        _id: '',
        present: false,
        username,
        coopname: config.coopname,
        display_name: displayName,
        program_key,
        status: ContributorStatus.PENDING,
        contributor_hash: generateRandomHash(),
        blagorost_offer_hash: actualBlagorostOfferHash,
        generator_offer_hash: actualGeneratorOfferHash,
        generation_contract_hash: undefined,
        storage_agreement_hash: undefined,
        blagorost_agreement_hash: undefined,
      };

      this.logger.info(`Создаем Contributor с данными:`, contributorData);

      const contributor = new ContributorDomainEntity(contributorData);
      this.logger.info(`Contributor создан, coopname: ${contributor.coopname}, username: ${contributor.username}`);

      await this.contributorRepository.create(contributor);

      this.logger.info(`Создан новый Contributor для участника ${username} с program_key: ${program_key}`);
    } catch (error) {
      const errorObj = error as Error;
      this.logger.error(`Ошибка при создании Contributor для участника ${username}: ${errorObj.message}`, errorObj.stack);
    }
  }

  /**
   * Маппинг шага онбординга в ключ флага конфигурации
   */
  private mapStepToFlag(step: string): keyof IConfig | null {
    const mapping: Record<string, keyof IConfig> = {
      generator_program_template: 'onboarding_generator_program_template_done',
      generation_contract_template: 'onboarding_generation_contract_template_done',
      generator_offer_template: 'onboarding_generator_offer_template_done',
      blagorost_program: 'onboarding_blagorost_provision_done',
      blagorost_offer_template: 'onboarding_blagorost_offer_template_done',
    };

    return mapping[step] || null;
  }
}
