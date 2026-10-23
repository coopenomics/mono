import { Global, Injectable, Module } from '@nestjs/common';
import type {
  IDesktopGrantsFilterHook,
  IDesktopGrantsFilterRegistryPort,
  InnerDesktopGrantsContext,
} from '@coopenomics/innercoop';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

/**
 * Сужающие фильтры прав на столах чужих расширений (канон — innercoop
 * `IDesktopGrantsFilterHook`). Ядро знает только реестр, авторов фильтров — нет.
 *
 * Итог — пересечение входного набора со всеми ответами: фильтр не может
 * добавить право, порядок применения на результат не влияет. Отказ фильтра
 * читается в пользу владельца стола: набор не меняется, сбой — в журнал.
 */
@Injectable()
export class ExtensionGrantsFilterRegistry implements IDesktopGrantsFilterRegistryPort {
  private readonly filters = new Map<string, IDesktopGrantsFilterHook>();

  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext(ExtensionGrantsFilterRegistry.name);
  }

  register(filter: IDesktopGrantsFilterHook): void {
    this.filters.set(filter.extensionName, filter);
  }

  unregister(extensionName: string): void {
    this.filters.delete(extensionName);
  }

  /** Права расширения `extensionName` после всех чужих фильтров. */
  async narrow(extensionName: string, grants: string[], ctx: InnerDesktopGrantsContext): Promise<string[]> {
    let result = new Set(grants);
    for (const [author, filter] of this.filters) {
      if (author === extensionName) continue; // свои права — через IDesktopGrantsHook
      try {
        const kept = new Set(await filter.filterGrants({ extensionName, grants: [...result] }, ctx));
        result = new Set([...result].filter((g) => kept.has(g)));
      } catch (e) {
        this.logger.warn(
          `Фильтр прав от «${author}» для стола «${extensionName}» отказал — права оставлены как есть: ${(e as Error)?.message ?? e}`
        );
      }
      if (result.size === 0) break;
    }
    return [...result];
  }
}

@Global()
@Module({
  providers: [ExtensionGrantsFilterRegistry],
  exports: [ExtensionGrantsFilterRegistry],
})
export class ExtensionGrantsFilterModule {}
