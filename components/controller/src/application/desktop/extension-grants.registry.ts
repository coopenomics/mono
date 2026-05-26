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
  private readonly providers = new Map<string, IExtensionDesktopGrantsProvider>();

  register(provider: IExtensionDesktopGrantsProvider): void {
    this.providers.set(provider.extensionName, provider);
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
    const provider = this.providers.get(extensionName);
    if (!provider) return undefined;
    return provider.resolveGrants(ctx);
  }
}

@Global()
@Module({
  providers: [ExtensionGrantsRegistry],
  exports: [ExtensionGrantsRegistry],
})
export class ExtensionGrantsModule {}
