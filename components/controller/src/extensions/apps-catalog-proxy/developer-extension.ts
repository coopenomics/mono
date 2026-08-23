/**
 * Расширение «developer» (487-27): два стола поверх прокси каталога.
 *
 *  - `developer` — «Стол разработчика» председателя: пакеты, релизы,
 *    модерация, издатели, pricing. Видимость — grant `Developer:manage`.
 *  - `publisher` — «Мои приложения» пайщика-издателя: свои пакеты и ключи
 *    каталога. Видимость — grant `Publisher:manage`, который выдаётся
 *    только аккаунтам из `apps_publishers`; остальным стол не показывается.
 *
 * Состояние расширения — таблица `apps_publishers` (см. entities). Конфига
 * нет: адреса каталога берутся из env контроллера.
 */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  BaseExtensionModule,
  EXTENSION_REPOSITORY,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import {
  DESKTOP_GRANTS_REGISTRY_PORT,
  LOGGER_PORT,
  type ILoggerPort,
  type IDesktopGrantsHook,
  type IDesktopGrantsRegistryPort,
  type InnerDesktopGrantsContext,
  MonoAccountStatus,
} from '@coopenomics/innercoop';
import { z } from 'zod';
import { AppsPublishersService } from './application/services/apps-publishers.service';

export const Schema = z.object({});
export type IConfig = z.infer<typeof Schema>;
export const defaultConfig: IConfig = {};

/** Права столов расширения `developer`. */
export const DEVELOPER_GRANTS = {
  /** Стол разработчика (председатель). */
  developerManage: 'Developer:manage',
  /** Мои приложения (назначенный издатель). */
  publisherManage: 'Publisher:manage',
} as const;

@Injectable()
export class DeveloperExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort,
  ) {
    super();
    this.logger.setContext(DeveloperExtension.name);
  }

  name = 'developer';
  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  async initialize(): Promise<void> {
    // состояния нет — таблица назначений создаётся TypeORM'ом
  }
}

/** Grants столов `developer`/`publisher`: председатель и назначенные издатели. */
@Injectable()
export class DeveloperDesktopGrantsProvider implements IDesktopGrantsHook, OnModuleInit {
  readonly extensionName = 'developer';

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort,
    private readonly publishers: AppsPublishersService,
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(this);
  }

  async resolveGrants(ctx: InnerDesktopGrantsContext): Promise<string[]> {
    if (!ctx.username) return [];
    if (ctx.userStatus !== MonoAccountStatus.Active) return [];
    const grants: string[] = [];
    if (ctx.userRole === 'chairman') grants.push(DEVELOPER_GRANTS.developerManage);
    const assignments = await this.publishers.listFor(ctx.username);
    if (assignments.length > 0) grants.push(DEVELOPER_GRANTS.publisherManage);
    return grants;
  }
}
