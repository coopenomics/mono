import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EXTENSION_APP_TERMINATE_EVENT, type ExtensionAppTerminatePayload } from '@coopenomics/extension-kit';
import type {
  IOrganizationLookupHook,
  IOrganizationLookupRegistryPort,
  InnerEntrepreneurLookupRecord,
  InnerOrganizationLookupRecord,
} from '@coopenomics/innercoop';

/** Предел ожидания реестра: анкета не должна висеть на медленном сервисе. */
export const ORGANIZATION_LOOKUP_TIMEOUT_MS = 5000;

class LookupTimeoutError extends Error {}

/**
 * Реестр поставщиков сведений об организации по ИНН.
 *
 * Расширение-коннектор (для России — DaData) кладёт себя сюда при запуске,
 * анкета вступления спрашивает по стране. На страну — один поставщик:
 * последний зарегистрированный заменяет прежнего. Остановленное расширение
 * снимается по `EXTENSION_APP_TERMINATE_EVENT`, и анкета этой страны
 * возвращается к ручному вводу.
 */
@Injectable()
export class OrganizationLookupRegistry implements IOrganizationLookupRegistryPort {
  private readonly logger = new Logger(OrganizationLookupRegistry.name);
  private readonly providers = new Map<string, IOrganizationLookupHook>();

  register(provider: IOrganizationLookupHook): void {
    this.providers.set(provider.country, provider);
  }

  /** Страны, для которых анкета заполняется по ИНН. */
  countries(): string[] {
    return [...this.providers.keys()];
  }

  /**
   * Сведения об организации по ИНН. Сбой или молчание сервиса анкету не
   * останавливают: ответ пустой, и пайщик заполняет поля сам, как без
   * поставщика.
   */
  async findByInn(country: string, inn: string): Promise<InnerOrganizationLookupRecord | null> {
    return this.ask(country, (provider) => provider.findByInn(inn));
  }

  /** Сведения об ИП по ИНН; коннектор без реестра ИП отвечает пусто. */
  async findEntrepreneurByInn(country: string, inn: string): Promise<InnerEntrepreneurLookupRecord | null> {
    return this.ask(country, (provider) => provider.findEntrepreneurByInn?.(inn) ?? Promise.resolve(null));
  }

  private async ask<T>(country: string, lookup: (provider: IOrganizationLookupHook) => Promise<T | null>): Promise<T | null> {
    const provider = this.providers.get(country);
    if (!provider) return null;

    try {
      return await withTimeout(lookup(provider), ORGANIZATION_LOOKUP_TIMEOUT_MS);
    } catch (error) {
      // i18n-ignore: запись в журнал узла о сбое поставщика, пайщику анкета отвечает «сведения не найдены»
      const reason = error instanceof LookupTimeoutError ? 'не ответил вовремя' : (error as Error)?.message ?? error;
      this.logger.warn(`Поставщик сведений об организации «${provider.extensionName}»: ${reason}`);
      return null;
    }
  }

  @OnEvent(EXTENSION_APP_TERMINATE_EVENT)
  onExtensionTerminate(payload: ExtensionAppTerminatePayload): void {
    for (const [country, provider] of this.providers) {
      if (provider.extensionName === payload.appName) this.providers.delete(country);
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    // timing: timeout — предел ожидания внешнего реестра, чтобы анкета не висела на медленном сервисе
    timer = setTimeout(() => reject(new LookupTimeoutError()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

@Global()
@Module({
  providers: [OrganizationLookupRegistry],
  exports: [OrganizationLookupRegistry],
})
export class OrganizationLookupRegistryModule {}
