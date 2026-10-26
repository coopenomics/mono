/**
 * Расширение «apps» — «Приложения» (26.10.2026): каталог приложений,
 * установленные приложения, подписки и кошелёк кооператива у провайдера, а
 * на узле оператора — страницы подключения кооператива-пайщика.
 *
 * Стол ставится каждому кооперативу (`defaults`): каталог встроенных
 * расширений нужен всем, а приложения из каталога и подписки появляются,
 * когда у узла есть канал к провайдеру. Раньше каталог жил в столе
 * председателя, а подключение — в столе пайщика; приложение, которое
 * управляет другими приложениями, поставляется как они.
 *
 * Права — `application/access/apps-rights.ts`. Состояние — таблица
 * `apps_catalog_apps` (миграции — `apps-catalog-proxy.database-migrations.ts`).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  BaseExtensionModule,
  EXTENSION_REPOSITORY,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { z } from 'zod';

export const Schema = z.object({});
export type IConfig = z.infer<typeof Schema>;
export const defaultConfig: IConfig = {};

@Injectable()
export class AppsExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
  ) {
    super();
    this.logger.setContext(AppsExtension.name);
  }

  name = 'apps';
  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize(): Promise<void> {
    // таблицу состояния создаёт миграция расширения, настраивать при запуске нечего
  }
}
