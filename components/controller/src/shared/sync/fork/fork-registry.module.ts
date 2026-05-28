import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { LoggerModule } from '~/application/logger/logger-app.module';
import { ForkRegistryService } from './fork-registry.service';

/**
 * Глобальный модуль реестра форк-обработчиков (ADR-005, Story 4.1).
 *
 * @Global — чтобы любой extension (capital, agreements, wallet, future) мог инжектить
 * ForkRegistryService без явного импорта; сбор syncer'ов идёт pull-моделью через
 * DiscoveryService на onApplicationBootstrap (никаких правок наследников
 * AbstractEntitySyncService не требуется).
 */
@Global()
@Module({
  imports: [DiscoveryModule, LoggerModule],
  providers: [ForkRegistryService],
  exports: [ForkRegistryService],
})
export class ForkRegistryModule {}
