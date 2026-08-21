import { Injectable } from '@nestjs/common';
import type {
  IRegistrationOfferFilterHook,
  IRegistrationOfferFilterRegistryPort,
  InnerAgreementRegistration,
  InnerProgramRegistration,
  InnerRegistrationOfferFilterContext,
} from '@coopenomics/innercoop';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

/**
 * Сужающие фильтры витрины вступления (канон — innercoop
 * `IRegistrationOfferFilterHook`). Расширение кладёт себя сюда само; ядро
 * показывает пересечение списка владельцев со всеми фильтрами. Собственные
 * программы и оферты автора фильтра не трогаются. Отказ фильтра — в пользу
 * владельца программы.
 */
@Injectable()
export class ExtensionOfferFilterRegistry implements IRegistrationOfferFilterRegistryPort {
  private readonly filters = new Map<string, IRegistrationOfferFilterHook>();

  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext(ExtensionOfferFilterRegistry.name);
  }

  register(filter: IRegistrationOfferFilterHook): void {
    this.filters.set(filter.extensionName, filter);
  }

  unregister(extensionName: string): void {
    this.filters.delete(extensionName);
  }

  narrowPrograms<T extends InnerProgramRegistration>(programs: T[], ctx: InnerRegistrationOfferFilterContext): T[] {
    return this.narrow(programs, ctx, (f, foreign) => f.filterPrograms(foreign, ctx), (p) => p.key, 'программ');
  }

  narrowAgreements<T extends InnerAgreementRegistration>(agreements: T[], ctx: InnerRegistrationOfferFilterContext): T[] {
    return this.narrow(agreements, ctx, (f, foreign) => f.filterAgreements(foreign, ctx), (a) => a.id, 'оферт');
  }

  private narrow<T extends { extension_name: string }>(
    items: T[],
    _ctx: InnerRegistrationOfferFilterContext,
    ask: (filter: IRegistrationOfferFilterHook, foreign: T[]) => readonly string[],
    keyOf: (item: T) => string,
    what: string
  ): T[] {
    let result = items;
    for (const [author, filter] of this.filters) {
      const own = result.filter((i) => i.extension_name === author);
      const foreign = result.filter((i) => i.extension_name !== author);
      if (foreign.length === 0) continue;
      try {
        const kept = new Set(ask(filter, foreign));
        result = [...own, ...foreign.filter((i) => kept.has(keyOf(i)))];
      } catch (e) {
        this.logger.warn(`Фильтр ${what} от «${author}» отказал — список оставлен как есть: ${(e as Error)?.message ?? e}`);
      }
    }
    return result;
  }
}
