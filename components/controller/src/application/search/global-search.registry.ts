import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type {
  IGlobalSearchHook,
  IGlobalSearchRegistryPort,
  InnerGlobalSearchContext,
  InnerGlobalSearchHit,
} from '@coopenomics/innercoop';

/** Исход опроса одного поставщика. */
export enum GlobalSearchGroupStatus {
  /** Поставщик ответил. */
  OK = 'ok',
  /** Не уложился в предел времени — остальные группы не ждали его. */
  TIMEOUT = 'timeout',
  /** Упал с ошибкой — ошибка записана в журнал узла. */
  ERROR = 'error',
}

export interface GlobalSearchGroup {
  key: string;
  title: string;
  icon: string;
  extension_name: string;
  status: GlobalSearchGroupStatus;
  hits: InnerGlobalSearchHit[];
}

/** Короче двух символов запрос ищет «всё подряд» и ничего не даёт. */
export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
/** Предел времени одного поставщика: медленный не держит окно. */
export const GLOBAL_SEARCH_PROVIDER_TIMEOUT_MS = 2500;

class ProviderTimeoutError extends Error {}

/**
 * Реестр поставщиков единого поиска.
 *
 * Владельцы данных — ядро и расширения — сами кладут сюда поставщиков при
 * запуске (`onModuleInit`), поэтому ядро опрашивает расширения, не импортируя
 * их модулей. Реестр глобальный: виден ядру, мосту портов и расширениям.
 */
@Injectable()
export class GlobalSearchRegistry implements IGlobalSearchRegistryPort {
  private readonly logger = new Logger(GlobalSearchRegistry.name);
  private readonly providers = new Map<string, IGlobalSearchHook>();

  register(provider: IGlobalSearchHook): void {
    this.providers.set(provider.key, provider);
  }

  /**
   * Опрашивает поставщиков параллельно. В ответ идут группы с находками и
   * группы, которые не ответили: окно покажет, что поиск по ним неполон.
   * Группы без находок и без сбоя не возвращаются.
   */
  async search(query: string, context: InnerGlobalSearchContext, limit: number): Promise<GlobalSearchGroup[]> {
    const q = query.trim();
    if (q.length < GLOBAL_SEARCH_MIN_QUERY_LENGTH) return [];

    const providers = [...this.providers.values()].sort((a, b) => a.order - b.order);
    const groups = await Promise.all(providers.map((provider) => this.ask(provider, q, context, limit)));
    return groups.filter((group) => group.hits.length > 0 || group.status !== GlobalSearchGroupStatus.OK);
  }

  private async ask(
    provider: IGlobalSearchHook,
    query: string,
    context: InnerGlobalSearchContext,
    limit: number
  ): Promise<GlobalSearchGroup> {
    const group = {
      key: provider.key,
      title: provider.title,
      icon: provider.icon,
      extension_name: provider.extensionName,
    };
    try {
      const hits = await withTimeout(provider.search(query, context, limit), GLOBAL_SEARCH_PROVIDER_TIMEOUT_MS);
      return { ...group, status: GlobalSearchGroupStatus.OK, hits: hits.slice(0, limit) };
    } catch (error) {
      if (error instanceof ProviderTimeoutError) {
        return { ...group, status: GlobalSearchGroupStatus.TIMEOUT, hits: [] };
      }
      this.logger.warn(`Поставщик поиска «${provider.key}» упал: ${(error as Error)?.message ?? error}`);
      return { ...group, status: GlobalSearchGroupStatus.ERROR, hits: [] };
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    // timing: timeout — предел ожидания одного поставщика, чтобы медленный не держал ответ окна
    timer = setTimeout(() => reject(new ProviderTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@Global()
@Module({
  providers: [GlobalSearchRegistry],
  exports: [GlobalSearchRegistry],
})
export class GlobalSearchRegistryModule {}
