import { Inject, Module } from '@nestjs/common';
import { z } from 'zod';
import { merge } from 'lodash';
import {
  BaseExtensionModule,
  DomainToBlockchainUtils,
  EXTENSION_REPOSITORY,
  type DeserializedDescriptionOfExtension,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
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
import { SovietRobotResolver } from './application/resolvers/soviet-robot.resolver';
import { ROBOT_EXTENSION_NAME } from './domain/constants';

function describeField(description: DeserializedDescriptionOfExtension): string {
  return JSON.stringify(description);
}

export const defaultConfig = {
  max_attempts: 5,
  retry_backoff_sec: 5,
};

export const Schema = z.object({
  max_attempts: z
    .number()
    .default(defaultConfig.max_attempts)
    .describe(
      describeField({
        label: 'Число попыток на одно решение',
        note: 'После исчерпания решение помечается как застрявшее и ждёт ручного повтора',
        rules: ['val >= 1'],
        prepend: 'Не больше',
        append: 'попыток',
      })
    ),
  retry_backoff_sec: z
    .number()
    .default(defaultConfig.retry_backoff_sec)
    .describe(
      describeField({
        label: 'Пауза между попытками (в секундах)',
        note: 'Умножается на номер попытки',
        rules: ['val >= 1'],
        prepend: 'Через',
        append: 'секунд',
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
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
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
    if (!extensionData) throw new Error('Конфиг не найден');
    this.extension = { ...extensionData, config: merge({}, defaultConfig, extensionData.config) };
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
  ],
  exports: [SovietRobotExtension, RobotRegistryService, RobotKeyService],
})
export class SovietRobotExtensionModule {}
