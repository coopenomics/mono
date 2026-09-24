import './i18n';
import { Inject, Module, Optional } from '@nestjs/common';
import { z } from 'zod';
import { merge } from 'lodash';
import { BaseExtensionModule, DomainToBlockchainUtils, EXTENSION_REPOSITORY, type DeserializedDescriptionOfExtension, type ExtensionDomainEntity, type ExtensionDomainRepository, DomainError } from '@coopenomics/extension-kit';
import { CHAIN_CHANGES_PORT, LOGGER_PORT, type IChainChangesPort, type ILoggerPort } from '@coopenomics/innercoop';
import { SovietRobotDatabaseModule } from './infrastructure/database/soviet-robot-database.module';
import { ROBOT_DECISION_REPOSITORY } from './domain/repositories/robot-decision.repository';
import { ROBOT_KEY_REPOSITORY } from './domain/repositories/robot-key.repository';
import { RobotDecisionTypeormRepository } from './infrastructure/repositories/robot-decision.typeorm-repository';
import { RobotKeyTypeormRepository } from './infrastructure/repositories/robot-key.typeorm-repository';
import { RobotChainService } from './application/services/robot-chain.service';
import { RobotKeyService } from './application/services/robot-key.service';
import { RobotRegistryService } from './application/services/robot-registry.service';
import { RobotDecisionService } from './application/services/robot-decision.service';
import { RobotWatchdogService } from './application/services/robot-watchdog.service';
import { RobotEventsService } from './application/services/robot-events.service';
import { RobotDesktopGrantsProvider } from './application/desktop/robot-desktop-grants.provider';
import { SovietRobotInnercoopAdapter } from './application/adapters/soviet-robot-innercoop.adapter';
import { SovietRobotResolver } from './application/resolvers/soviet-robot.resolver';
import { ROBOT_EXTENSION_NAME } from './domain/constants';
import { t } from './i18n';

function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

export const defaultConfig = {
  max_attempts: 5,
  retry_backoff_sec: 5,
  index_lag_attempts: 10,
  index_lag_pause_ms: 300,
};

export const Schema = z.object({
  max_attempts: z
    .number()
    .default(defaultConfig.max_attempts)
    .describe(
      describeField({
        label: t('sovietRobot.settings.maxAttemptsLabel'),
        note: t('sovietRobot.settings.maxAttemptsNote'),
        rules: ['val >= 1'],
        prepend: t('sovietRobot.settings.maxAttemptsPrepend'),
        append: t('sovietRobot.settings.maxAttemptsAppend'),
      })
    ),
  retry_backoff_sec: z
    .number()
    .default(defaultConfig.retry_backoff_sec)
    .describe(
      describeField({
        label: t('sovietRobot.settings.retryDelayLabel'),
        note: t('sovietRobot.settings.retryDelayNote'),
        rules: ['val >= 1'],
        prepend: t('sovietRobot.settings.retryDelayPrepend'),
        append: t('sovietRobot.settings.retryDelayAppend'),
      })
    ),
  index_lag_attempts: z
    .number()
    .default(defaultConfig.index_lag_attempts)
    .describe(
      describeField({
        label: t('sovietRobot.settings.protocolRetriesLabel'),
        note: t('sovietRobot.settings.protocolRetriesNote'),
        rules: ['val >= 1'],
        prepend: t('sovietRobot.settings.protocolRetriesPrepend'),
        append: t('sovietRobot.settings.protocolRetriesAppend'),
      })
    ),
  index_lag_pause_ms: z
    .number()
    .default(defaultConfig.index_lag_pause_ms)
    .describe(
      describeField({
        label: t('sovietRobot.settings.protocolRetryDelayLabel'),
        rules: ['val >= 0'],
        prepend: t('sovietRobot.settings.protocolRetryDelayPrepend'),
        append: t('sovietRobot.settings.protocolRetryDelayAppend'),
      })
    ),
});

export type IConfig = z.infer<typeof Schema>;

/**
 * Расширение «Робот совета»: принимает типовые решения совета автоматически
 * по правилам, которые члены совета задали в реестре автоматизаций контракта.
 */
export class SovietRobotExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository<IConfig>,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
    // Лента изменений: журнал робота на столе совета обновляется сам.
    @Optional() @Inject(CHAIN_CHANGES_PORT) private readonly chainChanges: IChainChangesPort | null = null
  ) {
    super();
    this.logger.setContext(SovietRobotExtension.name);
  }

  name = ROBOT_EXTENSION_NAME;
  extension!: ExtensionDomainEntity<IConfig>;

  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize() {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw DomainError.internal('SOVIET_ROBOT_CONFIG_NOT_FOUND');
    this.extension = { ...extensionData, config: merge({}, defaultConfig, extensionData.config) };
    // Решения робота — служебная таблица: журнал видит только совет.
    this.chainChanges?.declareLocalTables([{ code: this.name, table: 'soviet_robot_decisions', staff_only: true }]);
    this.logger.info(`Инициализация ${this.name} с конфигурацией`, this.extension.config);
  }
}

@Module({
  imports: [SovietRobotDatabaseModule],
  providers: [
    SovietRobotExtension,
    { provide: ROBOT_DECISION_REPOSITORY, useClass: RobotDecisionTypeormRepository },
    { provide: ROBOT_KEY_REPOSITORY, useClass: RobotKeyTypeormRepository },
    DomainToBlockchainUtils,
    RobotChainService,
    RobotKeyService,
    RobotRegistryService,
    RobotDecisionService,
    RobotWatchdogService,
    RobotEventsService,
    RobotDesktopGrantsProvider,
    SovietRobotResolver,
    // Порт для других расширений (Стол заказов): прямой вызов «реши сейчас».
    SovietRobotInnercoopAdapter,
  ],
  exports: [SovietRobotExtension, RobotRegistryService, RobotKeyService, SovietRobotInnercoopAdapter],
})
export class SovietRobotExtensionModule {
  constructor(private readonly robotExtension: SovietRobotExtension) {}

  /** Ядро вызывает initialize у экземпляра модуля при установке и включении расширения. */
  async initialize(config?: IConfig) {
    await this.robotExtension.initialize();
    void config;
  }
}
