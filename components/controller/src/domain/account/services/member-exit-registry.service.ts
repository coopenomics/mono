import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import {
  EXTENSION_APP_TERMINATE_EVENT,
  type ExtensionAppTerminatePayload,
} from '@coopenomics/extension-kit';
import type { IMemberExitRegistryPort, InnerExitBlockersProvider, InnerExitPendingReturn } from '@coopenomics/innercoop';

/**
 * Реестр причин, по которым расширение не пускает пайщика на выход.
 *
 * Деньги и соглашения при выходе ведёт цепь; расширение отвечает на один
 * вопрос — можно ли выходить сейчас. Ядро спрашивает все расширения разом и
 * показывает ответы пайщику в диалоге выхода.
 *
 * Tear-down автоматический: реестр подписан на остановку расширения, иначе
 * после перезапуска пайщик получал бы одну и ту же причину дважды.
 */
@Injectable()
export class MemberExitRegistryService implements IMemberExitRegistryPort {
  private readonly providers = new Map<string, InnerExitBlockersProvider>();

  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext(MemberExitRegistryService.name);
  }

  registerExitBlockers(provider: InnerExitBlockersProvider): void {
    this.providers.set(provider.extension_name, provider);
    this.logger.debug(`[EXIT] проверки выхода зарегистрированы: ${provider.extension_name}`);
  }

  unregisterExitBlockersByExtension(extensionName: string): void {
    if (this.providers.delete(extensionName)) {
      this.logger.debug(`[EXIT] проверки выхода сняты: ${extensionName}`);
    }
  }

  /**
   * Причины отказа от всех расширений. Расширение, упавшее на своей проверке,
   * выход не останавливает: отказ по технической ошибке запер бы пайщика в
   * кооперативе, поэтому ошибка пишется в журнал и пропускается.
   */
  async collectBlockers(coopname: string, username: string): Promise<string[]> {
    const results = await Promise.all(
      [...this.providers.values()].map(async (provider) => {
        try {
          return await provider.blockers(coopname, username);
        } catch (e) {
          this.logger.warn(
            `[EXIT] проверка выхода ${provider.extension_name} не отработала: ${(e as Error)?.message ?? e}`
          );
          return [];
        }
      })
    );
    return results.flat().filter((reason) => Boolean(reason?.trim()));
  }

  /**
   * Что выход ещё вернёт на кошельки программ, закрыв обязательства расширений.
   * Сбой расширения сумму не выдумывает: его возврат просто не попадёт в
   * предрасчёт, а контракт при выходе всё равно вернёт весь кошелёк программы.
   */
  async collectPendingReturns(coopname: string, username: string): Promise<InnerExitPendingReturn[]> {
    const results = await Promise.all(
      [...this.providers.values()].map(async (provider) => {
        if (!provider.pendingReturns) return [];
        try {
          return await provider.pendingReturns(coopname, username);
        } catch (e) {
          this.logger.warn(
            `[EXIT] возврат по обязательствам ${provider.extension_name} не посчитан: ${(e as Error)?.message ?? e}`
          );
          return [];
        }
      })
    );
    return results.flat().filter((r) => Number.parseFloat(r?.amount ?? '0') > 0);
  }
}

export const MEMBER_EXIT_REGISTRY_SERVICE = Symbol('MemberExitRegistryService');
