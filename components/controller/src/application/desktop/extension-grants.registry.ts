import { Global, Injectable, Module } from '@nestjs/common';
import type {
  IDesktopGrantsContext,
  IExtensionDesktopGrantsProvider,
} from '~/domain/desktop/ports/extension-grants.port';

/**
 * Реестр провайдеров грантов расширений (канон авторизации столов).
 *
 * Расширения САМИ регистрируются здесь в `onModuleInit` своего desktop-grants
 * провайдера (self-registration) — так платформенный `DesktopDomainInteractor`
 * собирает гранты, НЕ импортируя модули расширений (нет цикла зависимостей).
 * Реестр — глобальный синглтон (`@Global`), поэтому виден и интерактору, и
 * модулям расширений без явного импорта.
 */
@Injectable()
export class ExtensionGrantsRegistry {
  private readonly providers = new Map<string, IExtensionDesktopGrantsProvider[]>();

  /**
   * На одном столе сходятся права из нескольких таблиц: стол председателя
   * получает права ядра и права расширения «Председатель». Каждая таблица
   * кладёт своего поставщика, стол получает объединение.
   */
  register(provider: IExtensionDesktopGrantsProvider): void {
    const known = this.providers.get(provider.extensionName) ?? [];
    this.providers.set(provider.extensionName, [...known, provider]);
  }

  has(extensionName: string): boolean {
    return this.providers.has(extensionName);
  }

  /**
   * Гранты пользователя в расширении. Если провайдер не зарегистрирован —
   * `undefined` (расширение не использует канон → фронт на legacy-ролях).
   */
  async resolve(
    extensionName: string,
    ctx: IDesktopGrantsContext,
  ): Promise<string[] | undefined> {
    const providers = this.providers.get(extensionName);
    if (!providers) return undefined;
    const granted = await Promise.all(providers.map((provider) => provider.resolveGrants(ctx)));
    return [...new Set(granted.flat())];
  }
}

@Global()
@Module({
  providers: [ExtensionGrantsRegistry],
  exports: [ExtensionGrantsRegistry],
})
export class ExtensionGrantsModule {}
